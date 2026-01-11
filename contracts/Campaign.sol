// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//Campaign - Contrat d'une campagne de crowdfunding
contract Campaign {
    enum State { Active, Funded, Failed }

    uint256 public goal;// objectif en wei
    uint256 public deadline;// timestamp de fin de campagne
    uint256 public totalContributed;
    State public state;

    address public owner;// porteur de projet
    address public factory;// adresse de la CampaignFactory

    mapping(address => uint256) public contributions;
    address[] public contributors;

    event Contribution(address indexed contributor, uint256 amount);
    event Withdraw(address indexed owner, uint256 amount);
    event Refund(address indexed contributor, uint256 amount);
    event StateChanged(State newState);
    event RewardsDistributed(uint256 totalContributors);

// Restreint l'appel au porteur de projet
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

// Restreint l'appel à la factory
    modifier onlyFactory() {
        require(msg.sender == factory, "Not factory");
        _;
    }

// Vérifie que la campagne est dans l'état attendu
    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }

    constructor(
        uint256 _goal,
        uint256 _durationInSeconds,
        address _owner,
        address _factory
    ) {
        require(_goal > 0, "Goal must be > 0");
        require(_owner != address(0), "Zero owner");
        require(_factory != address(0), "Zero factory");

        owner = _owner;
        goal = _goal;
        deadline = block.timestamp + _durationInSeconds;
        state = State.Active;
        factory = _factory;
    }

    // Permet de contribuer en ETH tant que la campagne est active
    function contribute() external payable inState(State.Active) {
        require(block.timestamp < deadline, "Deadline passed");
        require(msg.value > 0, "No ETH sent");

        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }

        contributions[msg.sender] += msg.value;
        totalContributed += msg.value;

        emit Contribution(msg.sender, msg.value);

        if (totalContributed >= goal) {
            state = State.Funded;
            emit StateChanged(state);
        }
    }

    /// @notice Appelée par la factory lorsque le porteur retire les fonds et que les rewards doivent être calculées
    /// @dev Ne mint pas directement les tokens, renvoie les données à la factory
    function withdrawAndPrepareRewards()
        external
        onlyFactory
        inState(State.Funded)
        returns (address[] memory, uint256[] memory)
    {
        require(block.timestamp >= deadline, "Wait until deadline");

        uint256 amount = address(this).balance;
        require(amount > 0, "Nothing to withdraw");

// Transfert de tous les fonds au porteur de projet
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Withdraw(owner, amount);

        uint256 len = contributors.length;
        require(len > 0, "No contributors");

// Prépare les tableaux pour la factory (1 wei ETH = 1 wei CFD)
        address[] memory addrs = new address[](len);
        uint256[] memory amounts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            address contributor = contributors[i];
            uint256 contributed = contributions[contributor];
            if (contributed > 0) {
                addrs[i] = contributor;
                amounts[i] = contributed;
            }
        }

        emit RewardsDistributed(len);

        return (addrs, amounts);
    }

    // Premier appel côté donateur quand l'objectif n'est pas atteint après la deadline
    function refund() external inState(State.Active) {
        require(block.timestamp >= deadline, "Deadline not reached");
        require(totalContributed < goal, "Goal reached");

        state = State.Failed;
        emit StateChanged(state);

        _refundContributor(msg.sender);
    }

    /// @notice Appels suivants pour les autres contributeurs après passage à l'état Failed
    function claimRefund() external inState(State.Failed) {
        _refundContributor(msg.sender);
    }

// Gère le remboursement d'un contributeur donné
    function _refundContributor(address contributor) internal {
        uint256 amount = contributions[contributor];
        require(amount > 0, "Nothing to refund");

        contributions[contributor] = 0;

        (bool success, ) = payable(contributor).call{value: amount}("");
        require(success, "Refund transfer failed");

        emit Refund(contributor, amount);
    }

// Helper pour le frontend : nombre de contributeurs
    function getContributorsCount() external view returns (uint256) {
        return contributors.length;
    }

// Helper pour le frontend : solde ETH du contrat
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
