const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BrCodesPaymentProcessor", function () {
    async function deployPixPaymentProcessorFixture() {
        const [owner, minter, burner, treasuryWallet, customer] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(owner.address, minter.address, burner.address, owner.address);
        await eReais.waitForDeployment();

        const BrCodesPaymentProcessor = await ethers.getContractFactory("BrCodesPaymentProcessor");
        const brCodesPaymentProcessor = await BrCodesPaymentProcessor.deploy(
            eReais.target,
            owner.address,
            treasuryWallet.address
        );
        await brCodesPaymentProcessor.waitForDeployment();

        await eReais.grantRole(await eReais.MINTER_ROLE(), brCodesPaymentProcessor.target);
        await eReais.grantRole(await eReais.DEFAULT_ADMIN_ROLE(), brCodesPaymentProcessor.target);
        await eReais.grantRole(await eReais.BURNER_ROLE(), brCodesPaymentProcessor.target);

        return { eReais, brCodesPaymentProcessor, owner, minter, treasuryWallet, customer };
    }

    describe("Pix management", function () {
        it("Should register a Pix transaction correctly", async function () {
            const { brCodesPaymentProcessor, owner, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("100", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.id).to.equal(pixUuid);
            expect(pixDetails.amount).to.equal(pixAmount);
            expect(pixDetails.fee).to.equal(pixFee);
            expect(pixDetails.status).to.equal(0);
        });

        it("Should process Pix payment and mint eBRL correctly", async function () {
            const { eReais, owner, brCodesPaymentProcessor, minter, customer, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "1234abcd";
            const pixAmount = ethers.parseUnits("200", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            const netAmount = pixAmount - pixFee;


            await expect(brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address));
            await brCodesPaymentProcessor.connect(owner).processPixPayment(pixUuid);

            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(customerBalance).to.equal(netAmount);
            expect(treasuryBalance).to.equal(pixFee);

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });
    });

    it("Should process unregistered Pix payment correctly with 62 cents and 30 cents as fee", async function () {
        const { eReais, brCodesPaymentProcessor, owner, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

        const pixUuid = "272ebd61cefb4ff484c8c500d7f619e6";
        const pixAmount = ethers.parseUnits("0.62", "ether"); // 62 cents in ether units
        console.log("pixAmount: ", pixAmount);
        const pixFee = ethers.parseUnits("0.30", "ether"); // 30 cents in ether units
        console.log("pixFee: ", pixFee);
        const customerAddress = "0x81f4e5df59018576cae17a397a86eb2d6fcbfacf";

        // Check balances before the transaction
        const customerBalanceBefore = await eReais.balanceOf(customerAddress);
        const treasuryBalanceBefore = await eReais.balanceOf(treasuryWallet.address);
        console.log("Customer balance before:", customerBalanceBefore.toString());
        console.log("Treasury balance before:", treasuryBalanceBefore.toString());

        // Process unregistered Pix payment
        await brCodesPaymentProcessor.connect(owner).processUnregisteredPixPayment(pixUuid, pixAmount, pixFee, customerAddress);

        // Verify Pix details
        const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
        expect(pixDetails.id).to.equal(pixUuid);
        expect(pixDetails.amount).to.equal(pixAmount);
        expect(pixDetails.fee).to.equal(pixFee);
        expect(pixDetails.status).to.equal(1); // Status should be Paid

        // Check balances after the transaction
        const customerBalanceAfter = await eReais.balanceOf(customerAddress);
        const treasuryBalanceAfter = await eReais.balanceOf(treasuryWallet.address);
        console.log("Customer balance after:", ethers.formatEther(customerBalanceAfter.toString()));
        console.log("Treasury balance after:", ethers.formatEther(treasuryBalanceAfter.toString()));

        // Verify token balances
        expect(customerBalanceAfter).to.equal(customerBalanceBefore + (pixAmount) - (pixFee));
        expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore + (pixFee));
    });

    describe("Pix payment", function () {
        it("Should allow a user to pay a Pix and handle fee correctly", async function () {
            const { eReais, burner, brCodesPaymentProcessor, owner, minter, treasuryWallet, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseEther("100");
            const pixFee = ethers.parseEther("2");
            const pixNetAmount = pixAmount + pixFee;
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await eReais.connect(minter).issue(customer.address, pixNetAmount);

            try {
                await brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee);

                const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
                expect(treasuryBalance.toString()).to.equal(pixFee.toString());

                const customerFinalBalance = await eReais.balanceOf(customer.address);
                expect(customerFinalBalance.toString()).to.equal("0");

                const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
                expect(pixDetails.status).to.equal(1);
            } catch (error) {
                console.error("Transaction reverted:", error);
                throw error;
            }
        });

        it("Should revert when there is insufficient balance", async function () {
            const { brCodesPaymentProcessor, owner, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "insufficient1234";
            const pixAmount = ethers.parseEther("100");
            const pixFee = ethers.parseEther("2");
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await expect(
                brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee)
            ).to.be.revertedWith("Insufficient balance to pay Pix");

        });

        it("Should process unregistered Pix payment correctly with 0.3 cents", async function () {
            const { eReais, brCodesPaymentProcessor, owner, customer, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("0.003", "ether"); // 0.3 cents in ether units
            const pixFee = ethers.parseUnits("0.003", "ether"); // 0.3 cents in ether units
            console.log("pixAmount: ", pixAmount);
            console.log("pixFee: ", pixFee);

            // Process unregistered Pix payment
            await brCodesPaymentProcessor.connect(owner).processUnregisteredPixPayment(pixUuid, pixAmount, pixFee, customer.address);

            // Verify Pix details
            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.id).to.equal(pixUuid);
            expect(pixDetails.amount).to.equal(pixAmount);
            expect(pixDetails.fee).to.equal(pixFee);
            expect(pixDetails.status).to.equal(1); // Status should be Paid

            // Verify token balances
            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(customerBalance).to.equal(pixAmount - (pixFee));
            expect(treasuryBalance).to.equal(pixFee);
        });

        it("Should allow a user to pay a Pix and handle fee correctly", async function () {
            const { eReais, brCodesPaymentProcessor, owner, minter, treasuryWallet, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("0.97", "ether"); // 0.97 cents in ether units
            const pixFee = ethers.parseUnits("0.30", "ether"); // 30 cents in ether units
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await eReais.connect(minter).issue(customer.address, pixAmount + (pixFee)); // issue 1.27 cents to the customer

            await brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee);

            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(treasuryBalance).to.equal(pixFee);

            const customerFinalBalance = await eReais.balanceOf(customer.address);
            expect(customerFinalBalance).to.equal("0");

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });

    });
});
