// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Campaign.sol";
import "./ChainFundToken.sol";

interface ICampaignRewards {
    function withdrawAndPrepareRewards()
        external
        returns (address[] memory, uint256[] memory);
}

// CampaignFactory - Crée et référence les campagnes ChainFund
contract CampaignFactory {
    struct CampaignInfo {
        address campaignAddress;
        address owner;
        uint256 goal;
        uint256 deadline;
        bool exists;
    }

    address public admin;                // admin de la plateforme
    ChainFundToken public rewardToken;   // token CFD global
    CampaignInfo[] public campaigns;

    event CampaignCreated(
        uint256 indexed id,
        address campaignAddress,
        address owner,
        uint256 goal,
        uint256 deadline
    );

    event WithdrawExecuted(uint256 indexed id, address campaign, address owner);

// Restreint certaines actions à l'admin de la plateforme
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _rewardToken) {
        require(_rewardToken != address(0), "Zero token");
        admin = msg.sender;
        rewardToken = ChainFundToken(_rewardToken);
    }

    /// @notice Crée une nouvelle campagne de crowdfunding
    function createCampaign(
        uint256 _goal,
        uint256 _durationInSeconds
    ) external {
        address campaignOwner = msg.sender;

        Campaign newCampaign = new Campaign(
            _goal,
            _durationInSeconds,
            campaignOwner,
            address(this)
        );

        CampaignInfo memory info = CampaignInfo({
            campaignAddress: address(newCampaign),
            owner: campaignOwner,
            goal: _goal,
            deadline: block.timestamp + _durationInSeconds,
            exists: true
        });

        campaigns.push(info);
        uint256 id = campaigns.length - 1;

        emit CampaignCreated(
            id,
            address(newCampaign),
            campaignOwner,
            _goal,
            info.deadline
        );
    }

    // Permet au porteur d'une campagne de retirer les fonds et de déclencher la distribution de CFD
    function withdrawCampaign(uint256 campaignId) external {
        require(campaignId < campaigns.length, "Invalid id");
        CampaignInfo memory info = campaigns[campaignId];
        require(info.exists, "Campaign not found");

// Seul le propriétaire de la campagne peut lancer le retrait
        require(msg.sender == info.owner, "Not campaign owner");

// 1) La campagne envoie l'ETH au porteur et prépare les données de rewards
        (address[] memory addrs, uint256[] memory amounts) =
            ICampaignRewards(info.campaignAddress).withdrawAndPrepareRewards();

// 2) La factory (minter CFD) distribue les tokens aux contributeurs
        require(addrs.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] != address(0) && amounts[i] > 0) {
                // 1 wei ETH = 1 wei CFD => 1 ETH = 1 CFD
                rewardToken.mint(addrs[i], amounts[i]);
            }
        }

        emit WithdrawExecuted(campaignId, info.campaignAddress, info.owner);
    }

// Helper de vue : nombre total de campagnes créées
    function getCampaignsCount() external view returns (uint256) {
        return campaigns.length;
    }

// Helper de vue : infos publiques sur une campagne donnée
    function getCampaign(uint256 campaignId) external view returns (
        address campaignAddress,
        address owner,
        uint256 goal,
        uint256 deadline,
        bool exists
    ) {
        require(campaignId < campaigns.length, "Invalid id");
        CampaignInfo memory info = campaigns[campaignId];
        return (info.campaignAddress, info.owner, info.goal, info.deadline, info.exists);
    }
}
