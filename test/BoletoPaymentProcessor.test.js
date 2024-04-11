const {
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BoletoPaymentProcessor", function () {
    async function deployBoletoPaymentProcessorFixture() {
        const [owner, minter, burner, treasuryWallet, customer] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(owner.address, minter.address, burner.address, owner.address);
        await eReais.waitForDeployment();

        const BoletoPaymentProcessor = await ethers.getContractFactory("BoletoPaymentProcessor");
        const boletoPaymentProcessor = await BoletoPaymentProcessor.deploy(
            eReais.target,
            owner.address,
            minter.address,
            burner.address,
            treasuryWallet.address
        );
        await boletoPaymentProcessor.waitForDeployment();

        await eReais.grantRole(await eReais.MINTER_ROLE(), boletoPaymentProcessor.target);
        await eReais.grantRole(await eReais.DEFAULT_ADMIN_ROLE(), boletoPaymentProcessor.target);
        await eReais.grantRole(await eReais.BURNER_ROLE(), boletoPaymentProcessor.target);

        return { eReais, boletoPaymentProcessor, owner, minter, treasuryWallet, customer };
    }

    describe("Boleto management", function () {
        it("Should register a boleto correctly", async function () {
            const { boletoPaymentProcessor, owner, customer } = await loadFixture(deployBoletoPaymentProcessorFixture);

            const boletoId = "123456789";
            const boletoAmount = ethers.parseEther("100");
            const boletoFee = ethers.parseEther("2");
            const boletoName = "Customer Name";
            const boletoTaxId = "000.000.000-00";
            await boletoPaymentProcessor.connect(owner).registerBoleto(boletoId, boletoAmount, boletoFee, boletoName, boletoTaxId, customer.address);

            const boletoDetails = await boletoPaymentProcessor.getBoletoDetails(boletoId);
            expect(boletoDetails.id).to.equal(boletoId);
            expect(boletoDetails.amount).to.equal(boletoAmount);
            expect(boletoDetails.fee).to.equal(boletoFee);
            expect(boletoDetails.name).to.equal(boletoName);
            expect(boletoDetails.taxId).to.equal(boletoTaxId);
            expect(boletoDetails.status).to.equal(0);
        });

        it("Should process boleto payment and mint eBRL correctly", async function () {
            const { eReais, boletoPaymentProcessor, minter, owner, customer, treasuryWallet } = await loadFixture(deployBoletoPaymentProcessorFixture);

            const boletoId = "987654321";
            const boletoAmount = ethers.parseEther("200");
            const fee = ethers.parseEther("2");
            const netAmount = boletoAmount - fee;

            await expect(boletoPaymentProcessor.connect(owner).registerBoleto(boletoId, boletoAmount,fee, "Customer Name", "111.111.111-11", customer.address));
            const processTx = await boletoPaymentProcessor.connect(minter).processBoletoPayment(boletoId);
            await processTx.wait();

            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(customerBalance).to.equal(netAmount);
            expect(treasuryBalance).to.equal(fee);

            const boletoDetails = await boletoPaymentProcessor.getBoletoDetails(boletoId);
            expect(boletoDetails.status).to.equal(2);
        });
    });

    describe("Boleto payment", function () {
        it("Should allow a user to pay a Boleto and handle fee correctly", async function () {
            const { eReais, boletoPaymentProcessor, owner, minter, treasuryWallet, customer } = await loadFixture(deployBoletoPaymentProcessorFixture);
    
            const boletoId = "boleto123";
            const boletoAmount = ethers.parseEther("100");
            const boletoFee = ethers.parseEther("2");
            await boletoPaymentProcessor.connect(owner).registerBoleto(boletoId, boletoAmount, boletoFee, "Boleto Name", "000.000.000-00", customer.address);
    
            await eReais.connect(minter).issue(customer.address, boletoAmount);
    
            await boletoPaymentProcessor.connect(owner).payBoleto(boletoId, customer.address, boletoAmount, boletoFee);
    
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
            expect(treasuryBalance).to.equal(boletoFee);
    
            const customerFinalBalance = await eReais.balanceOf(customer.address);
            expect(customerFinalBalance).to.equal("0");
    
            const boletoDetails = await boletoPaymentProcessor.getBoletoDetails(boletoId);
            expect(boletoDetails.status).to.equal(2);
        });
    });
});
