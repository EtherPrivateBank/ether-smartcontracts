// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./eReais.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BoletoPaymentProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    enum BoletoStatus {
        Created,
        Paid
    }

    struct Boleto {
        string id;
        uint256 amount;
        string name;
        string taxId;
        BoletoStatus status;
    }

    mapping(string => Boleto) private boletos;

    event BoletoRegistered(string id, uint256 amount);
    event BoletoStatusUpdatedAndMinted(
        string id,
        uint256 netAmount,
        uint256 fee
    );

    constructor(
        address eBRLAddress,
        address defaultAdmin,
        address minter,
        address burner,
        address _treasuryWallet
    ) {
        eBRLContract = eReais(eBRLAddress);
        treasuryWallet = _treasuryWallet;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(eBRLContract.MINTER_ROLE(), minter);
        _grantRole(eBRLContract.BURNER_ROLE(), burner);
    }

    function registerBoleto(
        string memory _id,
        uint256 _amount,
        string memory _name,
        string memory _taxId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        boletos[_id] = Boleto(
            _id,
            _amount,
            _name,
            _taxId,
            BoletoStatus.Created
        );
        emit BoletoRegistered(_id, _amount);
    }

    function processBoletoPayment(
        string memory _id,
        address customer,
        uint256 fee
    ) external onlyRole(eBRLContract.MINTER_ROLE()) {
        Boleto storage boleto = boletos[_id];
        require(
            boleto.status == BoletoStatus.Created,
            "Boleto must be in Created status"
        );

        uint256 netAmount = boleto.amount - fee;
        eBRLContract.issue(customer, netAmount);
        eBRLContract.issue(treasuryWallet, fee);

        boleto.status = BoletoStatus.Paid;
        emit BoletoStatusUpdatedAndMinted(_id, netAmount, fee);
    }

    function getBoletoDetails(
        string memory _id
    ) public view returns (Boleto memory) {
        return boletos[_id];
    }
}
