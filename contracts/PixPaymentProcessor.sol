// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./eReais.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PixPaymentProcessor is AccessControl {
    eReais public eBRLContract;
    address public treasuryWallet;

    enum PixStatus {
        Created,
        Paid
    }

    struct Pix {
        string id;
        uint256 amount;
        uint256 fee;
        string[] tags;
        PixStatus status;
        address customerAddress;
        string pictureUrl;
    }

    mapping(string => Pix) private pixTransactions;

    event PixRegistered(
        string id,
        uint256 amount,
        uint256 fee,
        address customerAddress,
        string pictureUrl
    );
    event PixStatusUpdatedAndMinted(
        string id,
        uint256 netAmount,
        uint256 fee,
        address customerAddress
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

    function registerPix(
        string memory _id,
        uint256 _amount,
        uint256 _fee,
        string[] memory _tags,
        address _customerAddress,
        string memory _pictureUrl
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pixTransactions[_id] = Pix(
            _id,
            _amount,
            _fee,
            _tags,
            PixStatus.Created,
            _customerAddress,
            _pictureUrl
        );
        emit PixRegistered(_id, _amount, _fee, _customerAddress, _pictureUrl);
    }

    function processPixPayment(
        string memory _id
    ) external onlyRole(eBRLContract.MINTER_ROLE()) {
        Pix storage pix = pixTransactions[_id];
        require(
            pix.status == PixStatus.Created,
            "Pix must be in Created status"
        );

        uint256 netAmount = pix.amount - pix.fee;
        eBRLContract.issue(pix.customerAddress, netAmount);
        eBRLContract.issue(treasuryWallet, pix.fee);

        pix.status = PixStatus.Paid;
        emit PixStatusUpdatedAndMinted(
            _id,
            netAmount,
            pix.fee,
            pix.customerAddress
        );
    }

    function getPixDetails(
        string memory _id
    ) public view returns (Pix memory) {
        return pixTransactions[_id];
    }
}
