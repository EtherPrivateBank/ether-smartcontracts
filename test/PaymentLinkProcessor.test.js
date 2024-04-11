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
        const paymentLinkProcessor = await PaymentLinkProcessor.deploy(tokenContract.target, treasuryWallet.address, admin.address);
        await paymentLinkProcessor.waitForDeployment();

        await tokenContract.grantRole(await tokenContract.MINTER_ROLE(), paymentLinkProcessor.target);
        await tokenContract.grantRole(await tokenContract.DEFAULT_ADMIN_ROLE(), paymentLinkProcessor.target);

        return { admin, minter, customer, treasuryWallet, tokenContract, paymentLinkProcessor };
    }

    describe("Payment Link Creation and Processing", function () {
        it("Should allow creation of a payment link with fee and mint tokens to customer and treasury on successful payment", async function () {
            const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin } = await loadFixture(deployFixture);
            const uuid = "uuid123";
            const amount = ethers.parseEther("100");
            const fee = ethers.parseEther("5");
            await paymentLinkProcessor.createPaymentLink(uuid, amount, fee, customer.address);
            await paymentLinkProcessor.processPayment(uuid, true);

            const netAmount = amount - fee;
            const customerBalance = await tokenContract.balanceOf(customer.address);
            const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);

            expect(customerBalance).to.equal(netAmount, "Incorrect customer balance after payment processing");
            expect(treasuryBalance).to.equal(fee, "Incorrect treasury balance after payment processing");

            const paymentLink = await paymentLinkProcessor.paymentLinks(uuid);
            expect(paymentLink.status).to.equal(1);
        });

        it("Should set status to Failed on unsuccessful payment", async function () {
            const { paymentLinkProcessor, minter, customer } = await loadFixture(deployFixture);
            const uuid = "uuid789";
            const amount = ethers.parseEther("50");
            const fee = ethers.parseEther("3");

            await paymentLinkProcessor.createPaymentLink(uuid, amount, fee, customer.address);

            await paymentLinkProcessor.processPayment(uuid, false);

            const paymentLink = await paymentLinkProcessor.paymentLinks(uuid);
            expect(paymentLink.status).to.equal(2);
        });
    });

    it("Should fail to create a payment link if not admin", async function () {
        const { paymentLinkProcessor, customer } = await loadFixture(deployFixture);
        await expect(
            paymentLinkProcessor.connect(customer).createPaymentLink("uuidFail", ethers.parseEther("100"), ethers.parseEther("5"), customer.address)
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

    it("Should handle payment link with 0 fee", async function () {
        const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin } = await loadFixture(deployFixture);
        const uuidZeroFee = "uuidZeroFee";
        const amount = ethers.parseEther("50");
        await paymentLinkProcessor.connect(admin).createPaymentLink(uuidZeroFee, amount, 0, customer.address);

        await paymentLinkProcessor.connect(admin).processPayment(uuidZeroFee, true);

        const customerBalance = await tokenContract.balanceOf(customer.address);
        const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);

        expect(customerBalance).to.equal(amount);
        expect(treasuryBalance).to.equal(0);

        const paymentLink = await paymentLinkProcessor.paymentLinks(uuidZeroFee);
        expect(paymentLink.status).to.equal(1);
    });

    it("Should mint correct amount to treasury when processing multiple payment links", async function () {
        const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin } = await loadFixture(deployFixture);
        const uuidMultiple = "uuidMultiple";
        const amount1 = ethers.parseEther("100");
        const fee1 = ethers.parseEther("10");
        const amount2 = ethers.parseEther("200");
        const fee2 = ethers.parseEther("20");

        await paymentLinkProcessor.connect(admin).createPaymentLink(uuidMultiple + "1", amount1, fee1, customer.address);
        await paymentLinkProcessor.connect(admin).processPayment(uuidMultiple + "1", true);

        await paymentLinkProcessor.connect(admin).createPaymentLink(uuidMultiple + "2", amount2, fee2, customer.address);
        await paymentLinkProcessor.connect(admin).processPayment(uuidMultiple + "2", true);

        const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);
        expect(treasuryBalance).to.equal(fee1 + fee2);
    });

});
