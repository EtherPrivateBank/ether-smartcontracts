// test/BRLPaymentProcessor.test.js

const {
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BRLPaymentProcessor", function () {
    async function deployBRLPaymentProcessorFixture() {
        const [owner, minter, burner, treasuryWallet, customer] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(owner.address, minter.address, burner.address, owner.address);
        await eReais.waitForDeployment();

        const BRLPaymentProcessor = await ethers.getContractFactory("BRLPaymentProcessor");
        const brlPaymentProcessor = await BRLPaymentProcessor.deploy(
            eReais.target,
            owner.address,
            minter.address,
            burner.address,
            treasuryWallet.address
        );
        await brlPaymentProcessor.waitForDeployment();
        await eReais.grantRole(await eReais.MINTER_ROLE(), brlPaymentProcessor.target);
        await eReais.grantRole(await eReais.BURNER_ROLE(), brlPaymentProcessor.target);

        return { eReais, brlPaymentProcessor, owner, minter, burner, treasuryWallet, customer };
    }


    describe("Deployment", function () {
        it("Should process a deposit correctly", async function () {
            const { eReais, customer, minter, treasuryWallet, brlPaymentProcessor } = await loadFixture(deployBRLPaymentProcessorFixture);

            const depositAmount = ethers.parseEther("100");

            const fee = ethers.parseEther("1");
            const netAmount = depositAmount - fee;

            await brlPaymentProcessor.connect(minter).processDeposit(customer.address, depositAmount, "paymentId1", "deposit", fee);

            expect(await eReais.balanceOf(customer.address)).to.equal(netAmount);
            expect(await eReais.balanceOf(treasuryWallet.address)).to.equal(fee);
        });

        it("Should process a withdrawal correctly", async function () {
            const { eReais, customer, burner, minter, treasuryWallet, brlPaymentProcessor } = await loadFixture(deployBRLPaymentProcessorFixture);
            const initialAmount = ethers.parseEther("100");
            await eReais.connect(minter).issue(customer.address, initialAmount);

            const withdrawAmount = ethers.parseEther("50");
            const fee = ethers.parseEther("1");
            const grossAmount = withdrawAmount + fee;

            await brlPaymentProcessor.connect(burner).processWithdraw(customer.address, withdrawAmount, "paymentId2", "withdraw", fee);

            expect(await eReais.balanceOf(customer.address)).to.equal(initialAmount - grossAmount);
            expect(await eReais.balanceOf(treasuryWallet.address)).to.equal(fee);
        });

        it("Should correctly mint eReais on deposit", async function () {
            const { eReais, brlPaymentProcessor, minter, customer, treasuryWallet } = await loadFixture(deployBRLPaymentProcessorFixture);
            const depositAmount = ethers.parseEther("10");
            const fee = ethers.parseEther("0.5");
            const netAmount = depositAmount - fee;
    
            await brlPaymentProcessor.connect(minter).processDeposit(customer.address, depositAmount, "paymentID", "deposit", fee);
    
            const customerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalance = await eReais.balanceOf(treasuryWallet.address);
    
            expect(customerBalance).to.equal(netAmount);
            expect(treasuryBalance).to.equal(fee);
        });

        it("Should correctly burn eReais on withdrawal", async function () {
            const { eReais, brlPaymentProcessor, minter, burner, customer, treasuryWallet } = await loadFixture(deployBRLPaymentProcessorFixture);
            const initialMintAmount = ethers.parseEther("50");
            await eReais.connect(minter).issue(customer.address, initialMintAmount);
    
            const withdrawalAmount = ethers.parseEther("10");
            const fee = ethers.parseEther("0.5");
            const totalWithdrawal = withdrawalAmount + fee;
    
            await brlPaymentProcessor.connect(burner).processWithdraw(customer.address, withdrawalAmount, "withdrawID", "withdraw", fee);
    
            const finalCustomerBalance = await eReais.balanceOf(customer.address);
            const treasuryBalanceAfterWithdraw = await eReais.balanceOf(treasuryWallet.address);
    
            expect(finalCustomerBalance).to.equal(initialMintAmount - totalWithdrawal);
            expect(treasuryBalanceAfterWithdraw).to.equal(fee);
        });
    
    })
});