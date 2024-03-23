// ignition/modules/EBRLModule.js

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("EBRLModule", (m) => {
    const adminAddress = m.getParameter("adminAddress", "0x0Bb7024355A398D94539b86aB36E71645B59d025");
    const burnerAddress = m.getParameter("burnerAddress", "0xe01d2d7447Bb83CDEd0Adc7362752218F8F5479f");
    const complianceAddress = m.getParameter("complianceAddress", "0x0dD35E84e01A4326dB29F5546f3050145E32b4f5");
    const minterAddress = m.getParameter("minterAddress", "0x72241421aA4Dab753298989c26b53E3e682c566F");
    const pauserAddress = m.getParameter("pauserAddress", "0x25BF4e09814DaF3A915c493a4A36867181089561");
    const transferAddress = m.getParameter("transferAddress", "0x9316597a2d0057b16453354A596EecDDB9728a0a");

    const eReais = m.contract("eReais", [adminAddress, pauserAddress, minterAddress, burnerAddress, complianceAddress, transferAddress]);

    return { eReais };
});
