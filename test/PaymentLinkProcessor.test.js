const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentLinkProcessor", function () {
    async function deployFixture() {
        const [admin, minter, customer, treasuryWallet, beneficiary] = await ethers.getSigners();

        const eReais = await ethers.getContractFactory("eReais");
        const tokenContract = await eReais.deploy(admin.address, minter.address, admin.address, admin.address);
        await tokenContract.waitForDeployment();

        const PaymentLinkProcessor = await ethers.getContractFactory("PaymentLinkProcessor");
        const paymentLinkProcessor = await PaymentLinkProcessor.deploy(tokenContract.target, admin.address, treasuryWallet.address);
        await paymentLinkProcessor.waitForDeployment();

        await tokenContract.grantRole(await tokenContract.MINTER_ROLE(), paymentLinkProcessor.target);
        await tokenContract.grantRole(await tokenContract.DEFAULT_ADMIN_ROLE(), paymentLinkProcessor.target);

        return { admin, minter, customer, treasuryWallet, tokenContract, paymentLinkProcessor, beneficiary };
    }

    async function setupRates(paymentLinkProcessor, admin) {
        const fees = [
            { installments: 1, interestRate: 364, spreadRate: 22 },   // 3.64% interest, 0.22% spread
            { installments: 2, interestRate: 364, spreadRate: 22 },   // 3.64% interest, 0.22% spread
            { installments: 3, interestRate: 615, spreadRate: 75 },   // 6.15% interest, 0.75% spread
            { installments: 4, interestRate: 695, spreadRate: 90 },   // 6.95% interest, 0.90% spread
            { installments: 5, interestRate: 605, spreadRate: 170 },  // 6.05% interest, 1.70% spread
            { installments: 6, interestRate: 859, spreadRate: 20 },   // 8.59% interest, 0.20% spread
            { installments: 7, interestRate: 844, spreadRate: 300 },  // 8.44% interest, 3.00% spread
            { installments: 8, interestRate: 928, spreadRate: 360 },  // 9.28% interest, 3.60% spread
            { installments: 9, interestRate: 1013, spreadRate: 360 }, // 10.13% interest, 3.60% spread
            { installments: 10, interestRate: 1206, spreadRate: 260 },// 12.06% interest, 2.60% spread
            { installments: 11, interestRate: 1122, spreadRate: 400 },// 11.22% interest, 4.00% spread
            { installments: 12, interestRate: 1288, spreadRate: 310 },// 12.88% interest, 3.10% spread
            { installments: 13, interestRate: 1758, spreadRate: 300 },// 17.58% interest, 3.00% spread
            { installments: 14, interestRate: 1864, spreadRate: 300 },// 18.64% interest, 3.00% spread
            { installments: 15, interestRate: 1970, spreadRate: 300 },// 19.70% interest, 3.00% spread
            { installments: 16, interestRate: 2078, spreadRate: 300 },// 20.78% interest, 3.00% spread
            { installments: 17, interestRate: 2187, spreadRate: 200 },// 21.87% interest, 2.00% spread
            { installments: 18, interestRate: 2297, spreadRate: 200 },// 22.97% interest, 2.00% spread
            { installments: 19, interestRate: 2408, spreadRate: 200 },// 24.08% interest, 2.00% spread
            { installments: 20, interestRate: 2411, spreadRate: 200 },// 24.11% interest, 2.00% spread
            { installments: 21, interestRate: 2474, spreadRate: 200 } // 24.74% interest, 2.00% spread
        ];

        for (let { installments, interestRate, spreadRate } of fees) {
            await paymentLinkProcessor.connect(admin).setInterestRate(installments, interestRate);
            await paymentLinkProcessor.connect(admin).setSpreadRate(installments, spreadRate);
        }
    }


    describe("Payment Link Creation and Processing", function () {
        it("Should create and process a payment link with variable installments and correctly calculate fees", async function () {
            const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin, beneficiary } = await loadFixture(deployFixture);
            await setupRates(paymentLinkProcessor, admin);

            const uuid = "uuid123";
            const amount = ethers.parseEther("100");
            const installments = 21;

            // Fetch the interest and spread rates for the given number of installments
            const interestRate = await paymentLinkProcessor.interestRates(installments);
            const spreadRate = await paymentLinkProcessor.spreadRates(installments);

            // Calculate the total fee based on the interest and spread rates
            const interestAmount = (amount * interestRate) / 10000n;
            const spreadAmount = (amount * spreadRate) / 10000n;
            const treasuryAmount = (spreadAmount * 35n) / 100n; // 35% of spread
            const beneficiaryAmount = spreadAmount - treasuryAmount; // Remaining 65% of spread

            // Create and process the payment link
            await paymentLinkProcessor.createPaymentLink(uuid, amount, installments, customer.address, beneficiary.address);
            await paymentLinkProcessor.processPayment(uuid, true);

            // Calculate the net amount that should be the customer's balance after processing
            const netAmount = amount - interestAmount - spreadAmount;
            const customerBalance = await tokenContract.balanceOf(customer.address);
            const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);
            const beneficiaryBalance = await tokenContract.balanceOf(beneficiary.address);

            // Check the customer's, treasury's, and beneficiary's balances
            expect(customerBalance).to.equal(netAmount, "Incorrect customer balance after payment processing");
            expect(treasuryBalance).to.equal(treasuryAmount, "Incorrect treasury balance after payment processing");
            expect(beneficiaryBalance).to.equal(beneficiaryAmount, "Incorrect beneficiary balance after payment processing");

            const paymentLink = await paymentLinkProcessor.paymentLinks(uuid);
            expect(paymentLink.status).to.equal(1, "Payment link status should be Paid");
        });



        it("Should set status to Failed on unsuccessful payment", async function () {
            const { paymentLinkProcessor, beneficiary, customer } = await loadFixture(deployFixture);
            const uuid = "uuid789";
            const amount = ethers.parseEther("50");
            const fee = ethers.parseEther("3");
            const installments = 1;

            await paymentLinkProcessor.createPaymentLink(uuid, amount, installments, customer.address, beneficiary.address);

            await paymentLinkProcessor.processPayment(uuid, false);

            const paymentLink = await paymentLinkProcessor.paymentLinks(uuid);
            expect(paymentLink.status).to.equal(2);
        });
    });

    it("Should fail to create a payment link if not admin", async function () {
        const { paymentLinkProcessor, customer, beneficiary } = await loadFixture(deployFixture);
        const installments = 5;
        await expect(
            paymentLinkProcessor.connect(customer).createPaymentLink("uuidFail", ethers.parseEther("100"), installments, customer.address, beneficiary.address)
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

    it("Should handle payment link with 3.64% fee correctly", async function () {
        const { paymentLinkProcessor, tokenContract, customer, admin, treasuryWallet, beneficiary } = await loadFixture(deployFixture);
        await setupRates(paymentLinkProcessor, admin);

        const uuid = "uuidWithFee";
        const amount = ethers.parseEther("50");
        const installments = 1;
        const interestRate = await paymentLinkProcessor.interestRates(installments);
        const spreadRate = await paymentLinkProcessor.spreadRates(installments);

        await paymentLinkProcessor.createPaymentLink(uuid, amount, installments, customer.address, beneficiary.address);
        await paymentLinkProcessor.processPayment(uuid, true);

        const expectedFee = (amount * (interestRate) / (10000n)) + (amount * (spreadRate) / (10000n));
        const expectedCustomerBalance = amount - (expectedFee);
        const customerBalance = await tokenContract.balanceOf(customer.address);

        expect(customerBalance).to.equal(expectedCustomerBalance, "Incorrect customer balance after fee deduction");
    });

    it("Should mint correct amount to treasury when processing multiple payment links", async function () {
        const { paymentLinkProcessor, tokenContract, customer, treasuryWallet, admin, beneficiary } = await loadFixture(deployFixture);

        // Setting up installment rates
        await setupRates(paymentLinkProcessor, admin);

        const uuidMultiple1 = "uuidMultiple1";
        const amount1 = ethers.parseEther("100");
        const installments1 = 1; // Assuming spread rate setup for 1 installment
        const spreadRate1 = await paymentLinkProcessor.spreadRates(installments1);

        const uuidMultiple2 = "uuidMultiple2";
        const amount2 = ethers.parseEther("200");
        const installments2 = 1; // Assuming spread rate setup for 1 installment
        const spreadRate2 = await paymentLinkProcessor.spreadRates(installments2);

        // Creating and processing the first payment link
        await paymentLinkProcessor.createPaymentLink(uuidMultiple1, amount1, installments1, customer.address, beneficiary.address);
        await paymentLinkProcessor.processPayment(uuidMultiple1, true);

        // Creating and processing the second payment link
        await paymentLinkProcessor.createPaymentLink(uuidMultiple2, amount2, installments2, customer.address, beneficiary.address);
        await paymentLinkProcessor.processPayment(uuidMultiple2, true);

        // Calculating the expected treasury amounts for both payment links
        const expectedTreasuryAmount1 = (amount1 * spreadRate1 / 10000n) * 35n / 100n;
        const expectedTreasuryAmount2 = (amount2 * spreadRate2 / 10000n) * 35n / 100n;

        const treasuryBalance = await tokenContract.balanceOf(treasuryWallet.address);
        const expectedTotalTreasury = expectedTreasuryAmount1 + expectedTreasuryAmount2;

        // Verify the treasury balance matches the expected sum of the treasury portions
        expect(treasuryBalance.toString()).to.equal(expectedTotalTreasury.toString(), "Incorrect treasury balance after processing multiple payment links");
    });



});
