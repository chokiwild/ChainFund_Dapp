// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// ChainFundToken (CFD) - Token global mintable uniquement par la factory
contract ChainFundToken is ERC20, Ownable {
    address public minter; // adresse de la CampaignFactory autorisée à minter

    event MinterUpdated(address indexed newMinter);

    constructor()
        ERC20("ChainFund Token", "CFD")
        Ownable(msg.sender)
    {}

// Restreint l'appel à l'adresse minter
    modifier onlyMinter() {
        require(msg.sender == minter, "Not minter");
        _;
    }

    // Définit l'adresse autorisée à minter (en pratique la factory)
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Zero minter");
        minter = _minter;
        emit MinterUpdated(_minter);
    }

    // Appelé uniquement par la CampaignFactory pour minter des tokens
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
