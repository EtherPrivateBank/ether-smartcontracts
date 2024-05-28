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
            const pixTags = ["purchase", "online"];
            const pictureUrl = "https://example.com/pix/qrcode.png";
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, pixTags, customer.address, pictureUrl);

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.id).to.equal(pixUuid);
            expect(pixDetails.amount).to.equal(pixAmount);
            expect(pixDetails.fee).to.equal(pixFee);
            expect(pixDetails.tags).to.deep.equal(pixTags);
            expect(pixDetails.status).to.equal(0);
            expect(pixDetails.pictureUrl).to.equal(pictureUrl);
        });

        it("Should process Pix payment and mint eBRL correctly", async function () {
            const { eReais, owner, brCodesPaymentProcessor, minter, customer, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "1234abcd";
            const pixAmount = ethers.parseUnits("200", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            const netAmount = pixAmount - pixFee;
            const pixTags = ["sale", "book"];
            const pictureUrl = "https://example.com/pix/qrcode2.png";


            await expect(brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, pixTags, customer.address, pictureUrl));
            await brCodesPaymentProcessor.connect(owner).processPixPayment(pixUuid);

            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(customerBalance).to.equal(netAmount);
            expect(treasuryBalance).to.equal(pixFee);

            const pixDetails = await brCodesPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });
    });

    describe("Pix payment", function () {
        it("Should allow a user to pay a Pix and handle fee correctly", async function () {
            const { eReais, burner, brCodesPaymentProcessor, owner, minter, treasuryWallet, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseEther("100");
            const pixFee = ethers.parseEther("2");
            const pixTags = ["purchase", "online"];
            const pictureUrl = "https://example.com/pix/qrcode.png";
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, pixTags, customer.address, pictureUrl);

            await eReais.connect(minter).issue(customer.address, pixAmount);

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
            const pixTags = ["purchase", "online"];
            const pictureUrl = "https://example.com/pix/qrcode.png";
            await brCodesPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, pixTags, customer.address, pictureUrl);

            await expect(
                brCodesPaymentProcessor.connect(owner).payPix(pixUuid, customer.address, pixAmount, pixFee)
            ).to.be.revertedWith("Insufficient balance to pay Pix");

        });

    });
});
