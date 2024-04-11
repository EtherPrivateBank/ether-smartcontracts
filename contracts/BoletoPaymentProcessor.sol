// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./eReais.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BoletoPaymentProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    enum BoletoStatus {
        Created,
        Processing,
        Paid,
        Canceled,
        Failed
    }

    struct Boleto {
        string id;
        uint256 amount;
        uint256 fee;
        string name;
        string taxId;
        BoletoStatus status;
        address customerAddress;
    }

    mapping(string => Boleto) private boletos;

    event BoletoRegistered(
        string id,
        uint256 amount,
        uint256 fee,
        address customerAddress
    );

    event BoletoPaid(
        string id,
        uint256 amount,
        uint256 fee,
        address payerAddress
    );

    event BoletoStatusUpdatedAndMinted(
        string id,
        uint256 netAmount,
        uint256 fee,
        address customerAddress
    );

    event BoletoStatusUpdated(string id, BoletoStatus status);

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
        uint256 _fee,
        string memory _name,
        string memory _taxId,
        address _customerAddress
    ) external  onlyRole(DEFAULT_ADMIN_ROLE) {
        boletos[_id] = Boleto(
            _id,
            _amount,
            _fee,
            _name,
            _taxId,
            BoletoStatus.Created,
            _customerAddress
        );
        emit BoletoRegistered(_id, _amount, _fee, _customerAddress);
    }

    function processBoletoPayment(
        string memory _id
    ) external onlyRole(eBRLContract.MINTER_ROLE()) {
        Boleto storage boleto = boletos[_id];
        require(
            boleto.status == BoletoStatus.Created,
            "Boleto must be in Created status"
        );

        uint256 netAmount = boleto.amount - boleto.fee;
        eBRLContract.issue(boleto.customerAddress, netAmount);
        eBRLContract.issue(treasuryWallet, boleto.fee);

        boleto.status = BoletoStatus.Paid;
        emit BoletoStatusUpdatedAndMinted(
            _id,
            netAmount,
            boleto.fee,
            boleto.customerAddress
        );
    }

    function payBoleto(
        string memory _id,
        address payerAddress,
        uint256 amount,
        uint256 fee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Boleto storage boleto = boletos[_id];
        require(
            boleto.status == BoletoStatus.Created,
            "Boleto must be in Created status"
        );
        require(
            eBRLContract.balanceOf(payerAddress) >= boleto.amount,
            "Insufficient balance to pay Boleto"
        );

        eBRLContract.issue(treasuryWallet, fee);
        eBRLContract.redeem(payerAddress, amount);

        boleto.status = BoletoStatus.Paid;
        emit BoletoPaid(_id, amount, fee, payerAddress);
        emit BoletoStatusUpdated(_id, BoletoStatus.Paid);
    }

    function getBoletoDetails(
        string memory _id
    ) public view returns (Boleto memory) {
        return boletos[_id];
    }
}
