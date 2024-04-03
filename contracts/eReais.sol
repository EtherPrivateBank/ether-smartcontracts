// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @custom:security-contact security@etherprivatebank.com.br
contract eReais is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    mapping(address => bool) private _isBlacklisted;

    // Events
    event ContractPaused();
    event ContractUnpaused();
    event TokensIssued(address indexed to, uint256 amount);
    event TokensRedeemed(address indexed from, uint256 amount);
    event AddressBlacklisted(address indexed _address, bool _flag);
    event BlackFundsDestroyed(
        address indexed _blacklistAddress,
        uint256 amount
    );

    constructor(
        address defaultAdmin,
        address pauser,
        address minter,
        address burner,
        address complianceOfficer,
        address transferOfficer
    ) ERC20("eReais", "EBRL") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(COMPLIANCE_ROLE, complianceOfficer);
        _grantRole(TRANSFER_ROLE, transferOfficer);
        _grantRole(BURNER_ROLE, burner);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
        emit ContractPaused();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
        emit ContractUnpaused();
    }

    function issue(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(!_isBlacklisted[to], "Recipient is blacklisted");
        _mint(to, amount);
        emit TokensIssued(to, amount);
    }

    function redeem(uint256 amount) public onlyRole(BURNER_ROLE) {
        _burn(_msgSender(), amount);
        emit TokensRedeemed(_msgSender(), amount);
    }

    function isBlacklisted(address _address) public view returns (bool) {
        return _isBlacklisted[_address];
    }

    function blacklistAddress(
        address _address,
        bool _flag
    ) public onlyRole(COMPLIANCE_ROLE) {
        _isBlacklisted[_address] = _flag;
        emit AddressBlacklisted(_address, _flag);
    }

    // The following functions are overrides required by Solidity.
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        require(!_isBlacklisted[from], "Sender is blacklisted");
        require(!_isBlacklisted[to], "Recipient is blacklisted");
        super._update(from, to, value);
    }
}
