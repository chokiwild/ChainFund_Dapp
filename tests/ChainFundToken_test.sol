// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/ChainFundToken.sol";

contract ChainFundTokenTest {
    ChainFundToken token;
    address ownerAccount;
    address factoryAddr;
    address user;

    function beforeAll() public {
        ownerAccount = TestsAccounts.getAccount(0);
        factoryAddr = TestsAccounts.getAccount(1);
        user = TestsAccounts.getAccount(2);

        // Dans ce contexte, Ownable(msg.sender) => owner = address(this)
        token = new ChainFundToken();
    }

    function testInitialState() public {
        Assert.equal(token.name(), "ChainFund Token", "Name should be 'ChainFund Token'");
        Assert.equal(token.symbol(), "CFD", "Symbol should be 'CFD'");
        Assert.equal(token.minter(), address(0), "Minter should be zero at start");
        Assert.equal(token.totalSupply(), 0, "Total supply should be zero at start");
    }

    // On vérifie que setMinter fonctionne avec une adresse non nulle
    function testSetMinterFromOwner() public {
        token.setMinter(factoryAddr);
        Assert.equal(token.minter(), factoryAddr, "Minter should be factoryAddr");
    }

    // setMinter doit refuser l'adresse zéro
    function testSetMinterZeroReverts() public {
        (bool ok, ) = address(token).call(
            abi.encodeWithSignature("setMinter(address)", address(0))
        );
        Assert.equal(ok, false, "setMinter with zero address should fail");
    }

    // Mint doit échouer tant que minter n'est pas configuré sur un nouveau token
    function testMintWithoutMinterReverts() public {
        ChainFundToken localToken = new ChainFundToken();

        (bool ok, ) = address(localToken).call(
            abi.encodeWithSignature("mint(address,uint256)", user, 1 ether)
        );
        Assert.equal(ok, false, "Mint should fail when minter is zero");
    }

    // Une fois le minter défini, mint doit mettre à jour totalSupply et le solde
    function testMintUpdatesBalanceAndSupply() public {
        token.setMinter(address(this)); // ce contrat devient minter

        uint256 beforeSupply = token.totalSupply();
        uint256 beforeBalance = token.balanceOf(user);

        token.mint(user, 5 ether);

        uint256 afterSupply = token.totalSupply();
        uint256 afterBalance = token.balanceOf(user);

        Assert.equal(afterSupply, beforeSupply + 5 ether, "Total supply should increase by 5 CFD");
        Assert.equal(afterBalance, beforeBalance + 5 ether, "User balance should increase by 5 CFD");
    }
}
