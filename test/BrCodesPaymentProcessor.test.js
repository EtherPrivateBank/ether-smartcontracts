const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BrCodesPaymentProcessor", function () {
    async function deployPixPaymentProcessorFixture() {
        const [owner, treasuryWallet, customer] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(owner.address);
        await eReais.waitForDeployment();

        const BrCodesPaymentProcessor = await ethers.getContractFactory("BrCodesPaymentProcessor");
        const brCodesPaymentProcessor = await BrCodesPaymentProcessor.deploy(
            eReais.target,
            owner.address,
            treasuryWallet.address
        );
        await brCodesPaymentProcessor.waitForDeployment();

        await eReais.grantRole(await eReais.DEFAULT_ADMIN_ROLE(), brCodesPaymentProcessor.target);

        return { eReais, brCodesPaymentProcessor, owner, treasuryWallet, customer };
    }

    describe("Pix management", function () {
        it("Should register a Pix transaction correctly", async function () {
            const { brCodesPaymentProcessor, owner, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("100", "wei");
            const pixFee = ethers.parseUnits("2", "wei");

            const tx = await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);
            const receipt = await tx.wait();
            console.log(`Gas used for registerPix: ${receipt.gasUsed.toString()}`);

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.id).to.equal(pixUuid);
            expect(pixDetails.amount).to.equal(pixAmount);
            expect(pixDetails.fee).to.equal(pixFee);
            expect(pixDetails.status).to.equal(0);
        });

        it("Should process Pix payment and mint eBRL correctly", async function () {
            const { eReais, brCodesPaymentProcessor, owner, customer, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "1234abcd";
            const pixAmount = ethers.parseEther("200");
            const pixFee = ethers.parseEther("0.64");
            const burnAmount = ethers.parseEther("0.3");
            const netAmount = pixAmount - pixFee;
            const netFee = pixFee - burnAmount;

            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);
            const tx = await brCodesPaymentProcessor.connect(owner).processPixPayment(pixUuid, burnAmount);
            const receipt = await tx.wait();
            console.log(`Gas used for processPixPayment: ${receipt.gasUsed.toString()}`);

            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(customerBalance).to.equal(netAmount);
            expect(treasuryBalance).to.equal(netFee);

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });
    });

    describe("Pix payment", function () {
        it("Should allow a user to pay a Pix and handle fee correctly", async function () {
            const { eReais, brCodesPaymentProcessor, owner, treasuryWallet, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("100", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            const burnAmount = ethers.parseUnits("1", "wei");
            const totalAmount = pixAmount + pixFee;
            const netFee = pixFee - burnAmount;

            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await eReais.connect(owner).issue(customer.address, totalAmount);

            const tx = await brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee, burnAmount);
            const receipt = await tx.wait();
            console.log(`Gas used for payPix: ${receipt.gasUsed.toString()}`);

            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(treasuryBalance.toString()).to.equal(netFee.toString());

            const customerFinalBalance = await eReais.balanceOf(customer.address);
            expect(customerFinalBalance.toString()).to.equal("0");

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });

        it("Should handle a 20,000 deposit correctly", async function () {
            const { eReais, brCodesPaymentProcessor, owner, customer, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "deposit20000";
            const pixAmount = ethers.parseEther("20000"); // 20,000 reais
            const feePercentage = 2000 * 0.005; // 0.5%
            const feePercentageAmount = ethers.parseEther(feePercentage.toString());
            const additionalFee = ethers.parseEther("0.64"); // 64 cents
            const burnFee = ethers.parseEther("0.3"); // 0.3 cents

            const pixFee = feePercentageAmount + additionalFee;
            console.log(`Pix fee: ${pixFee.toString()}`); 
            console.log(`Burn fee: ${burnFee.toString()}`);
            console.log(`Net fee: ${pixFee - burnFee}`);
            const netFee = pixFee - burnFee;

            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await eReais.connect(owner).issue(customer.address, pixAmount + pixFee );

            const tx = await brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee, burnFee);
            const receipt = await tx.wait();
            console.log(`Gas used for payPix: ${receipt.gasUsed.toString()}`);

            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(treasuryBalance.toString()).to.equal(netFee.toString());

            const customerFinalBalance = await eReais.balanceOf(customer.address);
            expect(customerFinalBalance.toString()).to.equal("0");

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });

        it("Should revert when there is insufficient balance", async function () {
            const { brCodesPaymentProcessor, owner, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "deposit20000";
            const pixFee = ethers.parseEther("0.64"); // 64 cents
            const burnAmount = ethers.parseEther("0.3"); // 0.3 cents
            const pixAmount = ethers.parseEther("20000"); // 20,000 reais

            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await expect(
                brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee, burnAmount)
            ).to.be.revertedWith("Insufficient balance to pay Pix");
        });

        it("Should handle Pix payments with varying fees correctly", async function () {
            const { eReais, brCodesPaymentProcessor, owner, treasuryWallet, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("100", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            const burnAmount = ethers.parseUnits("1", "wei");
            const totalAmount = pixAmount + pixFee;
            const netFee = pixFee - burnAmount;

            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, customer.address);

            await eReais.connect(owner).issue(customer.address, totalAmount);

            const tx = await brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee, burnAmount);
            const receipt = await tx.wait();
            console.log(`Gas used for payPix: ${receipt.gasUsed.toString()}`);

            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(treasuryBalance.toString()).to.equal(netFee.toString());

            const customerFinalBalance = await eReais.balanceOf(customer.address);
            expect(customerFinalBalance.toString()).to.equal("0");

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });
    });
});
