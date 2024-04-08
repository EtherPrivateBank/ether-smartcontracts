const {
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PixPaymentProcessor", function () {
    async function deployPixPaymentProcessorFixture() {
        const [owner, minter, burner, treasuryWallet, customer] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(owner.address, minter.address, burner.address, owner.address);
        await eReais.waitForDeployment();

        const PixPaymentProcessor = await ethers.getContractFactory("PixPaymentProcessor");
        const pixPaymentProcessor = await PixPaymentProcessor.deploy(
            eReais.target,
            owner.address,
            minter.address,
            burner.address,
            treasuryWallet.address
        );
        await pixPaymentProcessor.waitForDeployment();

        await eReais.grantRole(await eReais.MINTER_ROLE(), pixPaymentProcessor.target);

        return { eReais, pixPaymentProcessor, owner, minter, treasuryWallet, customer };
    }

    describe("Pix management", function () {
        it("Should register a Pix transaction correctly", async function () {
            const { pixPaymentProcessor, owner, customer } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "abcd1234";
            const pixAmount = ethers.parseUnits("100", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            const pixTags = ["purchase", "online"];
            const pictureUrl = "https://example.com/pix/qrcode.png";
            await pixPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, pixTags, customer.address, pictureUrl);

            const pixDetails = await pixPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.id).to.equal(pixUuid);
            expect(pixDetails.amount).to.equal(pixAmount);
            expect(pixDetails.fee).to.equal(pixFee);
            expect(pixDetails.tags).to.deep.equal(pixTags);
            expect(pixDetails.status).to.equal(0);
            expect(pixDetails.pictureUrl).to.equal(pictureUrl);
        });

        it("Should process Pix payment and mint eBRL correctly", async function () {
            const { eReais, owner, pixPaymentProcessor, minter, customer, treasuryWallet } = await loadFixture(deployPixPaymentProcessorFixture);

            const pixUuid = "1234abcd";
            const pixAmount = ethers.parseUnits("200", "wei");
            const pixFee = ethers.parseUnits("2", "wei");
            const netAmount = pixAmount - pixFee;
            const pixTags = ["sale", "book"];
            const pictureUrl = "https://example.com/pix/qrcode2.png";


            await expect(pixPaymentProcessor.connect(owner).registerPix(pixUuid, pixAmount, pixFee, pixTags, customer.address, pictureUrl));
            await pixPaymentProcessor.connect(minter).processPixPayment(pixUuid);

            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(customerBalance).to.equal(netAmount);
            expect(treasuryBalance).to.equal(pixFee);

            const pixDetails = await pixPaymentProcessor.getPixDetails(pixUuid);
            expect(pixDetails.status).to.equal(1);
        });
    });
});
