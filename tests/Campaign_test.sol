// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/Campaign.sol";

contract CampaignTest {
    Campaign campaign;
    address owner;
    address factoryAddr;
    address contributor;

    function beforeAll() public {
        owner = TestsAccounts.getAccount(0);
        factoryAddr = TestsAccounts.getAccount(1);
        contributor = TestsAccounts.getAccount(2);

        // objectif = 1 ETH, durée = 1 heure
        campaign = new Campaign(1 ether, 3600, owner, factoryAddr);
    }

    function testInitialState() public {
        Assert.equal(uint(campaign.state()), uint(Campaign.State.Active), "State should be Active");
        Assert.equal(campaign.goal(), 1 ether, "Goal should be 1 ETH");
        Assert.equal(campaign.totalContributed(), 0, "Total contributed should be 0 at start");
    }

    // Remix ne gère pas directement msg.value ici, ce test vérifie juste le revert sans valeur
    function testContributeRevertsWithoutValue() public {
        (bool ok, ) = address(campaign).call(
            abi.encodeWithSignature("contribute()")
        );
        Assert.equal(ok, false, "Call without value should fail");
    }

    // Vérifie que refund() échoue tant que la campagne est Active et que l'objectif n'est pas explicitement en échec
    function testRefundFailsWhileActiveAndNoGoalCheck() public {
        (bool ok, ) = address(campaign).call(
            abi.encodeWithSignature("refund()")
        );
        Assert.equal(ok, false, "Refund should fail while campaign is still Active and Remix cannot simulate value/deadline properly");
    }
}
