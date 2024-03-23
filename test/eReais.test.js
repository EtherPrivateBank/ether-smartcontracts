const {
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EReais", function () {
    async function deployTokenFixture() {
        const [deployer, pauser, minter, burner, complianceOfficer, transferOfficer, otherAccount, recipient] = await ethers.getSigners();

        const EReais = await ethers.getContractFactory("eReais");
        const eReais = await EReais.deploy(deployer.address, pauser.address, minter.address, burner.address, complianceOfficer.address, transferOfficer.address);
        await eReais.deployed();

        return { EReais, eReais, deployer, pauser, minter, burner, complianceOfficer, transferOfficer, otherAccount, recipient };
    }

    describe("Deployment", function () {
        it("Should set the right roles", async function () {
            const { eReais, deployer, pauser, minter, complianceOfficer, transferOfficer } = await loadFixture(deployTokenFixture);

            expect(await eReais.hasRole(await eReais.DEFAULT_ADMIN_ROLE(), deployer.address)).to.equal(true);
            expect(await eReais.hasRole(await eReais.PAUSER_ROLE(), pauser.address)).to.equal(true);
            expect(await eReais.hasRole(await eReais.MINTER_ROLE(), minter.address)).to.equal(true);
            expect(await eReais.hasRole(await eReais.COMPLIANCE_ROLE(), complianceOfficer.address)).to.equal(true);
            expect(await eReais.hasRole(await eReais.TRANSFER_ROLE(), transferOfficer.address)).to.equal(true);
        });
    });

    describe("Minting", function () {
        it("Should mint tokens after compliance approval", async function () {
            const { eReais, minter, otherAccount, complianceOfficer } = await loadFixture(deployTokenFixture);

            await eReais.connect(complianceOfficer).blacklistAddress(otherAccount.address, false);
            await eReais.connect(minter).issue(otherAccount.address, 1000);

            expect(await eReais.balanceOf(otherAccount.address)).to.equal(1000);
        });

        it("Should not mint tokens to blacklisted addresses", async function () {
            const { eReais, minter, otherAccount, complianceOfficer } = await loadFixture(deployTokenFixture);

            await eReais.connect(complianceOfficer).blacklistAddress(otherAccount.address, true);

            await expect(eReais.connect(minter).issue(otherAccount.address, 1000)).to.be.revertedWith("Recipient is blacklisted");
        });
    });

    describe("Pausing", function () {
        it("Should pause and prevent transfers", async function () {
            const { eReais, pauser, minter, otherAccount, complianceOfficer } = await loadFixture(deployTokenFixture);
        
            await eReais.connect(complianceOfficer).blacklistAddress(otherAccount.address, false);
            await eReais.connect(minter).issue(otherAccount.address, 1000);
            await eReais.connect(pauser).pause();
            await expect(eReais.transfer(minter.address, 500)).to.be.reverted;
        });
        
    });

    describe("Role Management", function () {
        it("Should not allow unauthorized users to mint tokens", async function () {
            const { eReais, otherAccount, recipient } = await loadFixture(deployTokenFixture);

            await expect(eReais.connect(otherAccount).issue(recipient.address, 1000))
                .to.be.reverted
        });

        it("Should not allow unauthorized users to pause the contract", async function () {
            const { eReais,  otherAccount } = await loadFixture(deployTokenFixture);
            await expect(eReais.connect(otherAccount).pause())
                .to.be.reverted;
        });

        it("Should allow adding and removing a user from blacklist by compliance officer", async function () {
            const { eReais, otherAccount, complianceOfficer } = await loadFixture(deployTokenFixture);

            await eReais.connect(complianceOfficer).blacklistAddress(otherAccount.address, true);
            expect(await eReais.isBlacklisted(otherAccount.address)).to.equal(true);

            await eReais.connect(complianceOfficer).blacklistAddress(otherAccount.address, false);
            expect(await eReais.isBlacklisted(otherAccount.address)).to.equal(false);
        });

        it("Should not allow non-compliance officers to blacklist a user", async function () {
            const { eReais, otherAccount } = await loadFixture(deployTokenFixture);

            await expect(eReais.connect(otherAccount).blacklistAddress(otherAccount.address, true))
                .to.be.reverted;
        });
    });

    describe("Burning Tokens", function () {
        it("Should allow burning own tokens", async function () {
            const { eReais, minter, burner } = await loadFixture(deployTokenFixture);
    
            const mintAmount = 1000;
            const burnAmount = 500;
            await eReais.connect(minter).issue(burner.address, mintAmount);
            await eReais.connect(burner).redeem(burnAmount);
    
            const balanceAfterBurn = await eReais.balanceOf(burner.address);
            expect(balanceAfterBurn).to.equal(mintAmount - burnAmount);
        });
    

        it("Should prevent burning tokens when paused", async function () {
            const { eReais, pauser, minter } = await loadFixture(deployTokenFixture);

            const burnAmount = 500;
            await eReais.connect(pauser).pause();

            await expect(eReais.connect(minter).redeem(burnAmount))
                .to.be.reverted;

            // Unpause for subsequent tests
            await eReais.connect(pauser).unpause();
        });
    });
});
