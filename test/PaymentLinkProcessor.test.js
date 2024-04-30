const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentLinkProcessor", function () {
    async function deployFixture() {
        const [admin, minter, customer, treasuryWallet] = await ethers.getSigners();

        const eReais = await ethers.getContractFactory("eReais");
        const tokenContract = await eReais.deploy(admin.address, minter.address, admin.address, admin.address);
        await tokenContract.waitForDeployment();

        const PaymentLinkProcessor = await ethers.getContractFactory("PaymentLinkProcessor");
        const paymentLinkProcessor = await PaymentLinkProcessor.deploy(tokenContract.target, admin.address, treasuryWallet.address);
        await paymentLinkProcessor.waitForDeployment();

        await tokenContract.grantRole(await tokenContract.MINTER_ROLE(), paymentLinkProcessor.target);
        await tokenContract.grantRole(await tokenContract.DEFAULT_ADMIN_ROLE(), paymentLinkProcessor.target);

        return { admin, minter, customer, treasuryWallet, tokenContract, paymentLinkProcessor };
    }

    async function setupInstallmentFees(paymentLinkProcessor, admin) {
        const fees = [
            { installments: 1, feePercentage: 0 },
            { installments: 21, feePercentage: 2474 }
        ];

        expect(await paymentLinkProcessor.hasRole(await paymentLinkProcessor.DEFAULT_ADMIN_ROLE(), admin.address))
            .to.be.true;

        for (let i = 0; i < fees.length; i++) {
            await paymentLinkProcessor.connect(admin).setInstallmentFee(fees[i].installments, fees[i].feePercentage);
        }
    }

    describe("Payment Link Creation and Processing", function () {
        it("Should create and process a payment link with variable installments and correctly calculate fees", async function () {
            const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin } = await loadFixture(deployFixture);
            await setupInstallmentFees(paymentLinkProcessor, admin);

            const uuid = "uuid123";
            const amount = ethers.parseEther("100");
            const installments = 21;
            const installmentFeePercentage = await paymentLinkProcessor.installmentFees(installments);

            const calculatedFee = amount * (installmentFeePercentage) / (10000n);

            await paymentLinkProcessor.createPaymentLink(uuid, amount, installments, customer.address);
            await paymentLinkProcessor.processPayment(uuid, true);

            const netAmount = amount - (calculatedFee);
            const customerBalance = await tokenContract.balanceOf(customer.address);
            const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);

            expect(customerBalance).to.equal(netAmount, "Incorrect customer balance after payment processing");
            expect(treasuryBalance).to.equal(calculatedFee, "Incorrect treasury balance after payment processing");

            const paymentLink = await paymentLinkProcessor.paymentLinks(uuid);
            expect(paymentLink.status).to.equal(1);
        });


        it("Should set status to Failed on unsuccessful payment", async function () {
            const { paymentLinkProcessor, minter, customer } = await loadFixture(deployFixture);
            const uuid = "uuid789";
            const amount = ethers.parseEther("50");
            const fee = ethers.parseEther("3");
            const installments = 1;

            await paymentLinkProcessor.createPaymentLink(uuid, amount, installments, customer.address);

            await paymentLinkProcessor.processPayment(uuid, false);

            const paymentLink = await paymentLinkProcessor.paymentLinks(uuid);
            expect(paymentLink.status).to.equal(2);
        });
    });

    it("Should fail to create a payment link if not admin", async function () {
        const { paymentLinkProcessor, customer } = await loadFixture(deployFixture);
        const installments = 5;
        await expect(
            paymentLinkProcessor.connect(customer).createPaymentLink("uuidFail", ethers.parseEther("100"), installments, customer.address)
        ).to.be.reverted;
    });

    it("Should not process payment link not existing", async function () {
        const { paymentLinkProcessor, admin } = await loadFixture(deployFixture);
        await expect(
            paymentLinkProcessor.connect(admin).processPayment("nonExistentUUID", true)
        ).to.be.reverted;
    });

    it("Should not allow non-admin to process payment", async function () {
        const { paymentLinkProcessor, customer } = await loadFixture(deployFixture);
        await expect(
            paymentLinkProcessor.connect(customer).processPayment("uuid123", true)
        ).to.be.reverted;
    });

    it("Should handle payment link with 0 fee correctly", async function () {
        const { paymentLinkProcessor, tokenContract, customer, admin, treasuryWallet } = await loadFixture(deployFixture);
        await setupInstallmentFees(paymentLinkProcessor, admin);

        const uuidZeroFee = "uuidZeroFee";
        const amount = ethers.parseEther("50");
        const installments = 1;
        await paymentLinkProcessor.createPaymentLink(uuidZeroFee, amount, installments, customer.address);
        await paymentLinkProcessor.processPayment(uuidZeroFee, true);

        const customerBalance = await tokenContract.balanceOf(customer.address);
        const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);

        expect(customerBalance).to.equal(amount, "Incorrect balance when fee is zero");
        expect(treasuryBalance).to.equal(0, "Treasury should have zero balance for zero fee transaction");

        const paymentLink = await paymentLinkProcessor.paymentLinks(uuidZeroFee);
        expect(paymentLink.status).to.equal(1);
    });

    it("Should mint correct amount to treasury when processing multiple payment links", async function () {
        const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin } = await loadFixture(deployFixture);

        const uuidMultiple1 = "uuidMultiple1";
        const amount1 = ethers.parseEther("100");
        const installments1 = 1; // Assuming you have a fee set for 1 installment

        const uuidMultiple2 = "uuidMultiple2";
        const amount2 = ethers.parseEther("200");
        const installments2 = 1; // Assuming same here for simplicity

        await setupInstallmentFees(paymentLinkProcessor, admin);

        await paymentLinkProcessor.connect(admin).createPaymentLink(uuidMultiple1, amount1, installments1, customer.address);
        await paymentLinkProcessor.connect(admin).processPayment(uuidMultiple1, true);

        await paymentLinkProcessor.connect(admin).createPaymentLink(uuidMultiple2, amount2, installments2, customer.address);
        await paymentLinkProcessor.connect(admin).processPayment(uuidMultiple2, true);

        const feePercentage1 = await paymentLinkProcessor.installmentFees(installments1);
        const expectedFee1 = amount1 * (feePercentage1) / (10000n);

        const feePercentage2 = await paymentLinkProcessor.installmentFees(installments2);
        const expectedFee2 = amount2 * (feePercentage2) / (10000n);

        const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);
        expect(treasuryBalance).to.equal(expectedFee1 + (expectedFee2));
    });


});
