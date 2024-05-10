// test/WithdrawalProcessor.test.js

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WithdrawalProcessor", function () {
    async function deployWithdrawalProcessorFixture() {
        const [owner, user, treasury] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(owner.address, owner.address, owner.address, owner.address);
        await eReais.waitForDeployment();

        const WithdrawalProcessor = await ethers.getContractFactory("WithdrawalProcessor");
        const withdrawalProcessor = await WithdrawalProcessor.deploy(eReais.target, owner.address, treasury.address);
        await withdrawalProcessor.waitForDeployment();

        await eReais.connect(owner).grantRole(await eReais.DEFAULT_ADMIN_ROLE(), owner.address);
        await eReais.connect(owner).grantRole(await eReais.MINTER_ROLE(), withdrawalProcessor.target);
        await eReais.connect(owner).grantRole(await eReais.BURNER_ROLE(), withdrawalProcessor.target);

        return { withdrawalProcessor, eReais, user, treasury, owner };
    }


    describe("Withdrawal management", function () {
        it("Should allow a user to request a withdrawal", async function () {
            const { withdrawalProcessor, user, eReais, owner } = await loadFixture(deployWithdrawalProcessorFixture);

            await eReais.connect(owner).issue(user.address, ethers.parseEther("10"));
            await withdrawalProcessor.connect(owner).requestWithdrawal(1, user.address, ethers.parseEther("5"), ethers.parseEther("0.1"));

            const request = await withdrawalProcessor.connect(owner).withdrawalRequests(1);
            expect(request.user).to.equal(user.address);
            expect(request.amount).to.equal(ethers.parseEther("5"));
            expect(request.status).to.equal(0);
        });

        it("Should allow admin to approve a withdrawal", async function () {
            const { withdrawalProcessor, owner, user, eReais, treasury } = await loadFixture(deployWithdrawalProcessorFixture);

            const issueAmount = BigInt("10000000000000000000");
            await eReais.connect(owner).issue(user.address, issueAmount);

            const withdrawalAmount = BigInt("5000000000000000000");
            const fee = BigInt("100000000000000000");
            await withdrawalProcessor.connect(owner).requestWithdrawal(1, user.address, withdrawalAmount, fee);

            await withdrawalProcessor.connect(owner).approveWithdrawal(1);

            const request = await withdrawalProcessor.withdrawalRequests(1);
            expect(request.status).to.equal(1);

            const netAmount = withdrawalAmount - fee;
            const treasuryBalance = await eReais.balanceOf(treasury.address);
            const userBalance = await eReais.balanceOf(user.address);

            expect(treasuryBalance.toString()).to.equal(fee.toString());
            expect(userBalance.toString()).to.equal((issueAmount - netAmount).toString());
        });

        it("Should allow admin to cancel a withdrawal", async function () {
            const { withdrawalProcessor, owner, user, eReais } = await loadFixture(deployWithdrawalProcessorFixture);

            const issueAmount = BigInt("10000000000000000000");
            await eReais.connect(owner).issue(user.address, issueAmount);

            await withdrawalProcessor.connect(owner).requestWithdrawal(1, user.address, ethers.parseEther("5"), ethers.parseEther("0.1"));
            await withdrawalProcessor.connect(owner).cancelWithdrawal(1);

            const request = await withdrawalProcessor.withdrawalRequests(1);
            expect(request.status).to.equal(2);

            expect(await eReais.balanceOf(user.address)).to.equal(ethers.parseEther("10"));
        });

        it.only("Should handle a large withdrawal correctly", async function () {
            const { withdrawalProcessor, owner, user, eReais, treasury } = await loadFixture(deployWithdrawalProcessorFixture);
        
            const totalAmount = BigInt("10000000000000000000000000");
            const fee = totalAmount / BigInt(100);
            const netAmount = totalAmount - fee;
        
            await eReais.connect(owner).issue(user.address, totalAmount);
        
            await withdrawalProcessor.connect(owner).requestWithdrawal(1, user.address, netAmount, fee);
        
            await withdrawalProcessor.connect(owner).approveWithdrawal(1);
        
            const request = await withdrawalProcessor.withdrawalRequests(1);
            expect(request.status).to.equal(1);
        
            const treasuryBalance = await eReais.balanceOf(treasury.address);
            const userBalance = await eReais.balanceOf(user.address);
        
            expect(treasuryBalance.toString()).to.equal(fee.toString());
        
            expect(userBalance.toString()).to.equal((0).toString());
        });

    });
});
