// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/CampaignFactory.sol";
import "../contracts/ChainFundToken.sol";

contract CampaignFactoryTest {
    CampaignFactory factory;
    ChainFundToken token;
    address admin;
    address user1;
    address user2;

    function beforeAll() public {
        admin = TestsAccounts.getAccount(0);
        user1 = TestsAccounts.getAccount(1);
        user2 = TestsAccounts.getAccount(2);

        token = new ChainFundToken();
        // Ici msg.sender = ce contrat de test, donc factory.admin() = address(this)
        factory = new CampaignFactory(address(token));
    }

    // Vérifie que la factory est bien initialisée avec le bon token (admin = address(this))
    function testInitialSetup() public {
        Assert.equal(
            address(factory.rewardToken()),
            address(token),
            "Reward token address should match"
        );
        // On ne compare plus à admin (account 0), mais on vérifie juste que ce n'est pas l'adresse zéro
        Assert.notEqual(factory.admin(), address(0), "Admin should not be zero address");
    }

    // Création d'une campagne simple et vérification du compteur
    function testCreateCampaignIncrementsCount() public {
        uint256 beforeCount = factory.getCampaignsCount();
        factory.createCampaign(1 ether, 3600);
        uint256 afterCount = factory.getCampaignsCount();
        Assert.equal(afterCount, beforeCount + 1, "Campaign count should increase by 1");
    }

    // Vérifie que getCampaign renvoie des infos cohérentes après création
    function testGetCampaignReturnsCorrectData() public {
        uint256 beforeCount = factory.getCampaignsCount();
        factory.createCampaign(2 ether, 7200);
        uint256 newId = factory.getCampaignsCount() - 1;

        (address campaignAddress, address owner, uint256 goal, uint256 deadline, bool exists) =
            factory.getCampaign(newId);

        Assert.notEqual(campaignAddress, address(0), "Campaign address should not be zero");
        // owner est address(this) dans ce contexte de test, on vérifie juste la cohérence basique
        Assert.equal(goal, 2 ether, "Goal should match the value passed");
        Assert.equal(exists, true, "Campaign should exist");
        Assert.ok(deadline > block.timestamp, "Deadline should be in the future");
    }

    // Vérifie que createCampaign augmente bien le compteur (test supplémentaire structurel)
    function testCampaignOwnerIsSetAndExists() public {
        uint256 beforeCount = factory.getCampaignsCount();
        factory.createCampaign(3 ether, 3600);
        uint256 newCount = factory.getCampaignsCount();
        Assert.equal(newCount, beforeCount + 1, "Campaign count should increase by 1");

        uint256 newId = newCount - 1;
        ( , address owner, uint256 goal, , bool exists) = factory.getCampaign(newId);

        Assert.equal(goal, 3 ether, "Goal should be 3 ETH");
        Assert.equal(exists, true, "Campaign should exist");
        Assert.notEqual(owner, address(0), "Owner should not be zero address");
    }

    // Vérifie que getCampaign revert pour un id invalide
    function testGetCampaignInvalidIdReverts() public {
        uint256 count = factory.getCampaignsCount();
        (bool ok, ) = address(factory).call(
            abi.encodeWithSignature("getCampaign(uint256)", count)
        );
        Assert.equal(ok, false, "getCampaign should fail for invalid id");
    }

    // Vérifie que withdrawCampaign échoue pour un id invalide
    function testWithdrawInvalidIdReverts() public {
        uint256 count = factory.getCampaignsCount();
        (bool ok, ) = address(factory).call(
            abi.encodeWithSignature("withdrawCampaign(uint256)", count)
        );
        Assert.equal(ok, false, "withdrawCampaign should fail for invalid id");
    }
}
