const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { ethers, network, upgrades } = require('hardhat')

describe('NFTY Staking Upgradeable Test Contract', () => {
	let NFTY,
		nfty,
		Stake,
		stake,
		StakeUpgraded,
		stakeUpgraded,
		owner,
		addr1,
		addr2,
		decimals
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

	function getReward(lastClaimTime, currentTime, rate, amount) {
		let rewardTime = currentTime - lastClaimTime

		let oneYear = 365 * 24 * 60 * 60
		let rateForSecond = BigNumber.from(rate)
			.mul(BigNumber.from(10).pow(decimals))
			.div(BigNumber.from(oneYear))

		let reward = BigNumber.from(amount)
			.mul(BigNumber.from(rateForSecond))
			.mul(BigNumber.from(rewardTime))
			.div(BigNumber.from(10).pow(BigNumber.from(23)))

		return reward
	}

	function getAmount(value) {
		value = BigNumber.from(value).mul(BigNumber.from(10).pow(decimals))
		return value
	}

	beforeEach(async () => {
		NFTY = await ethers.getContractFactory('NFTYToken')
		nfty = await NFTY.deploy()
		await nfty.initialize()

		Stake = await ethers.getContractFactory('NFTYStakingUpgradeable')
		stake = await upgrades.deployProxy(Stake, [nfty.address], {
			initializer: 'initialize',
		})
		await stake.deployed()

		StakeUpgraded = await ethers.getContractFactory(
			'NFTYStakingUpgradeableTest'
		)
		stakeUpgraded = await upgrades.upgradeProxy(
			stake.address,
			StakeUpgraded
		)
		;[owner, addr1, addr2, _] = await ethers.getSigners()

		decimals = await nfty.decimals()
		adminRole = ethers.utils.id('ADMIN_ROLE')
		let stakeContractAmount = getAmount(5000000)
		await nfty.mint(await nfty.owner(), stakeContractAmount)
		await nfty.transfer(stakeUpgraded.address, stakeContractAmount)

		stakeBalance = await nfty.balanceOf(stakeUpgraded.address)
	})

	describe('Initializer', () => {
		it('Should revert if tried to call the initializer twice', async () => {
			await expect(
				stakeUpgraded.initialize(nfty.address)
			).to.be.revertedWith(
				'Initializable: contract is already initialized'
			)
		})
	})

	describe('Checking Admin from previous contract', () => {
		it('Should return the admin properly that has set by the last staking contract', async () => {
			expect(
				await stakeUpgraded.hasRole(adminRole, owner.address)
			).to.equal(true)
		})
	})

	describe('Deployment', () => {
		it('Should set the staking contract deployer as admin', async () => {
			expect(await stakeUpgraded.hasRole(adminRole, owner.address), true)
		})
	})

	describe('Stake Tokens', () => {
		it('Should revert if the staking amount is not greater than zero', async () => {
			let amount = 0
			await expect(
				stakeUpgraded.connect(addr1).stakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: value must be greater than zero')
		})

		it('Should revert if the staker has not enough balance in his account', async () => {
			let amount = getAmount(100)
			await expect(
				stakeUpgraded.connect(addr1).stakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: insufficient balance')
		})

		it('Should revert if the amount is less than min stake amount', async () => {
			let amount = getAmount(1)
			amount = BigNumber.from(amount).div(BigNumber.from(10))
			await expect(
				stakeUpgraded.connect(addr1).stakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: min stake amount is 1')
		})

		it('Should revert if the staker has not enough balance in his account', async () => {
			let amount = getAmount(100)
			await expect(
				stakeUpgraded.connect(addr1).stakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: insufficient balance')
		})

		it('Should stake the token and update the stake data properly for the new staker', async () => {
			let amount = getAmount(100)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let currentTimestamp = (await ethers.provider.getBlock()).timestamp
			let stakeAmount = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			let stakeReward = (await stakeUpgraded.StakersData(addr1.address))
				.reward
			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime
			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			expect(stakeAmount).to.equal(amount)
			expect(stakeReward).to.equal(0)
			expect(stakingTime).to.equal(currentTimestamp)
			expect(lastClaimTime).to.equal(currentTimestamp)
		})

		it('Should stake the token and update the stake data properly for the existing staker', async () => {
			let amount = getAmount(100)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime
			let oldStakingTime = (
				await stakeUpgraded.StakersData(addr1.address)
			).stakingTime

			// restake 100 more tokens after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 3

			let reward = getReward(
				lastClaimTime,
				currentTimestamp,
				13579,
				amount
			)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let newAmount = BigNumber.from(2).mul(BigNumber.from(amount))
			let stakeAmount = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			let stakeReward = (await stakeUpgraded.StakersData(addr1.address))
				.reward
			let newStakingTime = (
				await stakeUpgraded.StakersData(addr1.address)
			).stakingTime
			let newLastClaimTime = (
				await stakeUpgraded.StakersData(addr1.address)
			).lastClaimTime

			expect(stakeAmount).to.equal(newAmount)
			expect(stakeReward).to.equal(reward)
			expect(oldStakingTime).to.equal(newStakingTime)
			expect(newLastClaimTime).to.equal(currentTimestamp)
		})

		it('Should accumulate rewards each the staker add new tokens', async () => {
			let amount = getAmount(100)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			// restake 100 more tokens after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 3
			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime
			let oldStakingTime = (
				await stakeUpgraded.StakersData(addr1.address)
			).stakingTime

			let rewardOne = getReward(
				lastClaimTime,
				currentTimestamp,
				13579,
				amount
			)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			// restake 100 more tokens after one more week
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			currentTimestamp = (await ethers.provider.getBlock()).timestamp + 3
			lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime
			let newAmount = BigNumber.from(2).mul(BigNumber.from(amount))

			let rewardTwo = getReward(
				lastClaimTime,
				currentTimestamp,
				13579,
				newAmount
			)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			newAmount = BigNumber.from(3).mul(BigNumber.from(amount))
			let totalReward = BigNumber.from(rewardOne).add(
				BigNumber.from(rewardTwo)
			)

			let stakeAmount = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			let stakeReward = (await stakeUpgraded.StakersData(addr1.address))
				.reward
			let newStakingTime = (
				await stakeUpgraded.StakersData(addr1.address)
			).stakingTime
			let newLastClaimTime = (
				await stakeUpgraded.StakersData(addr1.address)
			).lastClaimTime

			expect(stakeAmount).to.equal(newAmount)
			expect(stakeReward).to.equal(totalReward)
			expect(oldStakingTime).to.equal(newStakingTime)
			expect(newLastClaimTime).to.equal(currentTimestamp)
		})
	})

	describe('Claim Reward', () => {
		it('Should revert if the claimer is not a staker', async () => {
			await expect(
				stakeUpgraded.connect(addr1).claimRewards()
			).to.be.revertedWith('NFTYStaking: caller is not a staker')
		})

		it('Should revert if the staking contract balance is not enough for releasing the reward', async () => {
			let amount = getAmount(1)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			// transfer all the amount from the staking contract
			await stakeUpgraded.transferAllTokens()

			// claiming the reward after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			await expect(
				stakeUpgraded.connect(addr1).claimRewards()
			).to.be.revertedWith('NFTYStaking: insufficient balance')
		})

		it('Should transfer and update the details properly after releasing reward', async () => {
			let amount = getAmount(100)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			await stakeUpgraded.connect(addr1).claimRewards()

			let balanceOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				13579,
				amount
			)
			let balanceAfterClaim = await nfty.balanceOf(addr1.address)			
			let reward = (await stakeUpgraded.StakersData(addr1.address)).reward

			expect(balanceAfterClaim).to.equal(balanceOfStaker)
			expect(reward).to.equal(0)
		})		

		it('Should release reward properly for an Iron - rate 14.579%', async () => {
			let amount = getAmount(500)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after one month
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			await stakeUpgraded.connect(addr1).claimRewards()

			let balanceOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				14579,
				amount
			)
			let balanceAfterClaim = await nfty.balanceOf(addr1.address)		

			expect(balanceAfterClaim).to.equal(balanceOfStaker)
		})

		it('Should release reward properly for a Silver - rate 15.079%', async () => {
			let amount = getAmount(10000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after 45 days
			let time = 45 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			await stakeUpgraded.connect(addr1).claimRewards()

			let balanceOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				15079,
				amount
			)
			let balanceAfterClaim = await nfty.balanceOf(addr1.address)			

			expect(balanceAfterClaim).to.equal(balanceOfStaker)
		})

		it('Should release reward properly for a Gold - rate 15.579%', async () => {
			let amount = getAmount(25000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after 90 days
			let time = 90 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			await stakeUpgraded.connect(addr1).claimRewards()

			let balanceOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				15579,
				amount
			)
			let balanceAfterClaim = await nfty.balanceOf(addr1.address)	

			expect(balanceAfterClaim).to.equal(balanceOfStaker)
		})

		it('Should release reward properly for a Platinum - rate 15.829%', async () => {
			let amount = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after 180 days
			let time = 180 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			await stakeUpgraded.connect(addr1).claimRewards()

			let balanceOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				15829,
				amount
			)
			let balanceAfterClaim = await nfty.balanceOf(addr1.address)			

			expect(balanceAfterClaim).to.equal(balanceOfStaker)
		})

		it('Should release reward properly for a Diamond - rate 16.079%', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after one year
			let time = 365 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			await stakeUpgraded.connect(addr1).claimRewards()

			let balanceOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				16079,
				amount
			)
			let balanceAfterClaim = await nfty.balanceOf(addr1.address)			

			expect(balanceAfterClaim).to.equal(balanceOfStaker)
		})
	})

	describe('Unstake Tokens', () => {
		it('Should revert if the un staking amount is not greater than zero', async () => {
			let amount = 0
			await expect(
				stakeUpgraded.connect(addr1).unstakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: value must be greater than zero')
		})

		it('Should revert if the caller is not a staker', async () => {
			let amount = getAmount(1)
			await expect(
				stakeUpgraded.connect(addr1).unstakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: caller is not a staker')
		})

		it('Should revert if the caller has not enough balance to unstake', async () => {
			let amount = getAmount(1)
			let newAmount = getAmount(2)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			await expect(
				stakeUpgraded.connect(addr1).unstakeTokens(newAmount)
			).to.be.revertedWith('NFTYStaking: not enough staked token')
		})

		it('Should revert if the staking contract balance is not enough for releasing the reward', async () => {
			let amount = getAmount(1)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			// transfer all the amount from the staking contract
			await stakeUpgraded.transferAllTokens()

			// claiming the reward after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			await expect(
				stakeUpgraded.connect(addr1).unstakeTokens(amount)
			).to.be.revertedWith('NFTYStaking: insufficient balance')
		})

		it('Should transfer the amount and update the data properly after unstaking a part of amount', async () => {
			let amount = getAmount(10)
			let unsAmount = getAmount(1)
			let remAmount = getAmount(9)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			let rewardOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				13579,
				amount
			)

			await stakeUpgraded.connect(addr1).unstakeTokens(unsAmount)

			let balanceAfterUnstake = await nfty.balanceOf(addr1.address)
			let balAmount = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			let balReward = (await stakeUpgraded.StakersData(addr1.address))
				.reward
			let newClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime
			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			expect(balanceAfterUnstake).to.equal(unsAmount)
			expect(balAmount).to.equal(remAmount)
			expect(balReward).to.equal(rewardOfStaker)
			expect(newClaimTime).to.equal(currentTimestamp)
			expect(stakingTime).to.equal(lastClaimTime)
		})

		it('Should transfer the amount and update the data properly after unstaking the whole amount', async () => {
			let amount = getAmount(10)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let lastClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime

			// claiming the reward after one week
			let week = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [week])
			await network.provider.send('evm_mine')

			let currentTimestamp =
				(await ethers.provider.getBlock()).timestamp + 1

			let rewardOfStaker = getReward(
				lastClaimTime,
				currentTimestamp,
				13579,
				amount
			)
			let balanceOfStaker = BigNumber.from(rewardOfStaker).add(
				BigNumber.from(amount)
			)

			await stakeUpgraded.connect(addr1).unstakeAll()

			let balanceAfterUnstake = await nfty.balanceOf(addr1.address)
			let balAmount = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			let balReward = (await stakeUpgraded.StakersData(addr1.address))
				.reward
			let newClaimTime = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime
			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			expect(balanceAfterUnstake).to.equal(balanceOfStaker)
			expect(balAmount).to.equal(0)
			expect(balReward).to.equal(0)
			expect(newClaimTime).to.equal(currentTimestamp)
			expect(stakingTime).to.equal(0)
		})
	})

	describe('Transfer All Amount', () => {
		it('Should revert if there is no tokens to transfer except staked amount', async () => {
			let amount = getAmount(1)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			await stakeUpgraded.transferAllTokens()

			await expect(stakeUpgraded.transferAllTokens()).to.be.revertedWith(
				'NFTYStaking: no tokens to transfer'
			)
		})

		it('Should transfer all the tokens to the nfty owner except the staked amount of stakers', async () => {
			let amount = getAmount(100)
			let bal = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			await stakeUpgraded.transferAllTokens()

			let totalStakedAmount = await stakeUpgraded.getPool()
			let balanceOfStake = await nfty.balanceOf(stakeUpgraded.address)
			let balanceOfNftyOwner = await nfty.balanceOf(await nfty.owner())

			let balNfty = BigNumber.from(bal).add(BigNumber.from(stakeBalance))

			expect(totalStakedAmount).to.equal(amount)
			expect(balanceOfStake).to.equal(amount)
			expect(balanceOfNftyOwner).to.equal(balNfty)
		})
	})

	describe('Change Rates', () => {
		it('Should revert if the caller is not an Admin', async () => {
			await expect(
				stakeUpgraded.connect(addr1).changeRate(0, 10001)
			).to.be.revertedWith(
				`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${adminRole}`
			)
		})

		it('Should revert if the rate is not in between 0 and 100', async () => {
			await expect(stakeUpgraded.changeRate(0, 0)).to.be.revertedWith(
				'NFTYStaking: invalid rate'
			)
			await expect(
				stakeUpgraded.changeRate(0, 100001)
			).to.be.revertedWith('NFTYStaking: invalid rate')
		})

		it('Should revert if the rank is not in between 0 and 5 (Patron to Diamond)', async () => {
			await expect(
				stakeUpgraded.changeRate(6, 100000)
			).to.be.revertedWith('NFTYStaking: invalid rank')
		})

		it('Should change the rate properly for the rank Patron', async () => {
			await stakeUpgraded.changeRate(0, 10000)

			let rewardRates = await stakeUpgraded.getRewardRates()
			expect(rewardRates[0]).to.equal(10000)
		})

		it('Should change the rate properly for the rank Iron', async () => {
			await stakeUpgraded.changeRate(1, 10000)

			let rewardRates = await stakeUpgraded.getRewardRates()
			expect(rewardRates[1]).to.equal(10000)
		})

		it('Should change the rate properly for the rank Silver', async () => {
			await stakeUpgraded.changeRate(2, 10000)

			let rewardRates = await stakeUpgraded.getRewardRates()
			expect(rewardRates[2]).to.equal(10000)
		})

		it('Should change the rate properly for the rank Gold', async () => {
			await stakeUpgraded.changeRate(3, 10000)

			let rewardRates = await stakeUpgraded.getRewardRates()
			expect(rewardRates[3]).to.equal(10000)
		})

		it('Should change the rate properly for the rank Platinum', async () => {
			await stakeUpgraded.changeRate(4, 10000)

			let rewardRates = await stakeUpgraded.getRewardRates()
			expect(rewardRates[4]).to.equal(10000)
		})

		it('Should change the rate properly for the rank Diamond', async () => {
			await stakeUpgraded.changeRate(5, 10000)

			let rewardRates = await stakeUpgraded.getRewardRates()
			expect(rewardRates[5]).to.equal(10000)
		})
	})

	describe('Get Pool', () => {
		it('Should return the total staked amount in the platform', async () => {
			let amountOne = getAmount(100)
			let amountTwo = getAmount(200)

			await nfty.mint(addr1.address, amountOne)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amountOne)
			await stakeUpgraded.connect(addr1).stakeTokens(amountOne)

			await nfty.mint(addr2.address, amountTwo)
			await nfty.connect(addr2).approve(stakeUpgraded.address, amountTwo)
			await stakeUpgraded.connect(addr2).stakeTokens(amountTwo)

			let total = BigNumber.from(amountOne).add(BigNumber.from(amountTwo))
			expect(await stakeUpgraded.getPool()).to.equal(total)
		})
	})

	describe('Reward Rates', () => {
		it('Should return the reward rates properly for the Patron', async () => {
			let amount = getAmount(1)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return level 0 as the reward rate for 500 but less than 30 days', async () => {
			let amount = getAmount(500)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return the reward rates properly for the Iron', async () => {
			let amount = getAmount(500)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one month
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(14579)
		})

		it('Should return level 0 as the reward rate for 10000 but less than 30 days', async () => {
			let amount = getAmount(10000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return level 1 as the reward rate for 10000 but between 30 and 45 days', async () => {
			let amount = getAmount(10000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after 45 days
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(14579)
		})

		it('Should return the reward rates properly for the Silver', async () => {
			let amount = getAmount(10000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after 45 days
			let time = 45 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15079)
		})

		it('Should return level 0 as the reward rate for 25000 but less than 30 days', async () => {
			let amount = getAmount(25000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return level 1 as the reward rate for 25000 and between 30 and 45 days', async () => {
			let amount = getAmount(25000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime
			// claiming the reward after 90 days
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(14579)
		})

		it('Should return level 2 as the reward rate for 25000 and between 45 and 90 days', async () => {
			let amount = getAmount(25000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime
			// claiming the reward after 90 days
			let time = 45 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15079)
		})

		it('Should return the reward rates properly for the Gold', async () => {
			let amount = getAmount(25000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime
			// claiming the reward after 90 days
			let time = 90 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15579)
		})

		it('Should return level 0 as the reward rate for 50000 and less than 30 days', async () => {
			let amount = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return level 1 as the reward rate for 50000 and between 30 and 45 days', async () => {
			let amount = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after 180 days
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(14579)
		})

		it('Should return level 2 as the reward rate for 50000 and between 45 and 90 days', async () => {
			let amount = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after 180 days
			let time = 45 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15079)
		})

		it('Should return level 3 as the reward rate for 50000 and between 90 and 180 days', async () => {
			let amount = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after 180 days
			let time = 90 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15579)
		})

		it('Should return the reward rates properly for the Platinum', async () => {
			let amount = getAmount(50000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after 180 days
			let time = 180 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15829)
		})

		it('Should return level 0 as the reward rate for 100000 and less than 30 days', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return level 1 as the reward rate for 100000 and between 30 and 45 days', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(14579)
		})

		it('Should return level 2 as the reward rate for 100000 and between 45 and 90 days', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 45 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15079)
		})

		it('Should return level 3 as the reward rate for 100000 and between 90 and 180 days', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 90 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15579)
		})

		it('Should return level 4 as the reward rate for 100000 and between 180 and 365 days', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 180 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15829)
		})

		it('Should return the reward rates properly for the Diamond', async () => {
			let amount = getAmount(100000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 365 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(16079)
		})

		it('Should return level 0 as the reward rate for 150000 and less than 30 days', async () => {
			let amount = getAmount(150000)

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(13579)
		})

		it('Should return level 1 as the reward rate for 150000 and between 30 and 45 days', async () => {
			let amount = getAmount(150000)

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 30 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(14579)
		})

		it('Should return level 2 as the reward rate for 150000 and between 45 and 90 days', async () => {
			let amount = getAmount(150000)

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 45 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15079)
		})

		it('Should return level 3 as the reward rate for 150000 and between 90 and 180 days', async () => {
			let amount = getAmount(150000)

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 90 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15579)
		})

		it('Should return level 4 as the reward rate for 150000 and between 180 and 365 days', async () => {
			let amount = getAmount(150000)

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 180 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(15829)
		})

		it('Should return level 5 as the reward rate for 150000 and between 365 and 450 days', async () => {
			let amount = getAmount(150000)

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// claiming the reward after one year
			let time = 365 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(16079)
		})

		it('Should return new rank as the reward rate for 150000 and 450 days', async () => {
			let amount = getAmount(150000)

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let stakingTime = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime

			// add rank
			await stakeUpgraded.addRank(0, 17000)

			// claiming the reward after one year
			let time = 450 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			// returning the reward rate
			let rewardRate = await stakeUpgraded.getRewardRate(
				amount,
				stakingTime
			)
			expect(rewardRate).to.equal(17000)
		})
	})

	describe('Access Control', () => {
		it('Admin should be able to add another admin', async () => {
			await stakeUpgraded.grantRole(adminRole, addr1.address)

			let result = await stakeUpgraded.hasRole(adminRole, addr1.address)
			expect(result).to.equal(true)
		})

		it('New Admin should be able to add another admin', async () => {
			await stakeUpgraded.grantRole(adminRole, addr1.address)
			await stakeUpgraded
				.connect(addr1)
				.grantRole(adminRole, addr2.address)

			let result = await stakeUpgraded.hasRole(adminRole, addr2.address)
			expect(result).to.equal(true)
		})

		it('One Admin should be able to revoke another admin', async () => {
			await stakeUpgraded.grantRole(adminRole, addr1.address)
			await stakeUpgraded
				.connect(addr1)
				.grantRole(adminRole, addr2.address)

			let result = await stakeUpgraded.hasRole(adminRole, addr1.address)
			expect(result).to.equal(true)

			await stakeUpgraded.revokeRole(adminRole, addr1.address)

			result = await stakeUpgraded.hasRole(adminRole, addr1.address)
			expect(result).to.equal(false)
			result = await stakeUpgraded.hasRole(adminRole, addr2.address)
			expect(result).to.equal(true)
		})

		it('Should revert if one Admin tries to renounce another Admin', async () => {
			await stakeUpgraded.grantRole(adminRole, addr1.address)

			await expect(
				stakeUpgraded.renounceRole(adminRole, addr1.address)
			).to.be.revertedWith(
				'AccessControl: can only renounce roles for self'
			)
		})

		it('One Admin should be able to renounce themselves', async () => {
			await stakeUpgraded.grantRole(adminRole, addr1.address)

			let result = await stakeUpgraded.hasRole(adminRole, addr1.address)
			expect(result).to.equal(true)

			await stakeUpgraded
				.connect(addr1)
				.renounceRole(adminRole, addr1.address)

			result = await stakeUpgraded.hasRole(adminRole, addr1.address)
			expect(result).to.equal(false)
		})
	})

	describe('Return Staker Data', () => {
		it('Should return the staker data properly', async () => {
			let amount = getAmount(100)

			await nfty.transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stakeUpgraded.connect(addr1).stakeTokens(amount)

			let currentTimestamp = (await ethers.provider.getBlock()).timestamp

			let result = await stakeUpgraded.getStakerData(addr1.address)

			expect(result.amount).to.equal(amount)
			expect(result.reward).to.equal(0)
			expect(result.stakingTime).to.equal(currentTimestamp)
			expect(result.lastClaimTime).to.equal(currentTimestamp)
		})
	})

	describe('Adding Rank', () => {
		it('Should be able to add one more rank properly', async () => {
			await stakeUpgraded.addRank(0, 17000)
			let result = await stakeUpgraded.getNewRewardRates()

			expect(result[0]).to.equal(17000)
		})
	})
})

// For testing if the stakers data from
// the contractOne still exist after upgrading the contract
describe('Staking Upgradeable Contract Stake Data test', () => {
	let NFTY,
		nfty,
		Stake,
		stake,
		StakeUpgraded,
		stakeUpgraded,
		owner,
		addr1,
		addr2,
		decimals

	function getReward(lastClaimTime, currentTime, rate, amount) {
		let rewardTime = currentTime - lastClaimTime
		let oneYear = 365 * 24 * 60 * 60
		let rateForSecond = BigNumber.from(rate)
			.mul(BigNumber.from(10).pow(decimals))
			.div(BigNumber.from(oneYear))
		let reward = BigNumber.from(amount)
			.mul(BigNumber.from(rateForSecond))
			.mul(BigNumber.from(rewardTime))
			.div(BigNumber.from(10).pow(BigNumber.from(21)))

		return reward
	}

	function getAmount(value) {
		value = BigNumber.from(value).mul(BigNumber.from(10).pow(decimals))
		return value
	}

	describe('Staking Data', () => {
		it('The staker data from previous contract should not be changed after upgrading', async () => {
			NFTY = await ethers.getContractFactory('NFTYToken')
			nfty = await NFTY.deploy()
			await nfty.initialize()

			Stake = await ethers.getContractFactory('NFTYStakingUpgradeable')
			stake = await upgrades.deployProxy(Stake, [nfty.address], {
				initializer: 'initialize',
			})
			await stake.deployed()
			;[owner, addr1, addr2, _] = await ethers.getSigners()

			decimals = await nfty.decimals()
			adminRole = ethers.utils.id('ADMIN_ROLE')
			let stakeContractAmount = getAmount(5000000)
			await nfty.mint(stake.address, stakeContractAmount)

			stakeBalance = await nfty.balanceOf(stake.address)

			let amount = getAmount(100)

			// stake tokens from first contract
			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stake.address, amount)
			await stake.connect(addr1).stakeTokens(amount)

			// add few more tokens after one week
			time = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stake.address, amount)
			await stake.connect(addr1).stakeTokens(amount)

			// retrieve data from the contract one
			let stakeTime1 = (await stake.StakersData(addr1.address))
				.stakingTime
			let amount1 = (await stake.StakersData(addr1.address)).amount
			let claimTime1 = (await stake.StakersData(addr1.address))
				.lastClaimTime
			let reward1 = (await stake.StakersData(addr1.address)).reward

			// upgrade the contract
			StakeUpgraded = await ethers.getContractFactory(
				'NFTYStakingUpgradeableTest'
			)
			stakeUpgraded = await upgrades.upgradeProxy(
				stake.address,
				StakeUpgraded
			)

			// retrieve the data from the new contract
			let stakeTime2 = (await stakeUpgraded.StakersData(addr1.address))
				.stakingTime
			let amount2 = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			let claimTime2 = (await stakeUpgraded.StakersData(addr1.address))
				.lastClaimTime
			let reward2 = (await stakeUpgraded.StakersData(addr1.address))
				.reward

			expect(stakeTime1).to.equal(stakeTime2)
			expect(claimTime1).to.equal(claimTime2)
			expect(amount1).to.equal(amount2)
			expect(reward1).to.equal(reward2)

			// add few more tokens after one week from the new contract
			time = 7 * 24 * 60 * 60
			await network.provider.send('evm_increaseTime', [time])
			await network.provider.send('evm_mine')

			await nfty.mint(addr1.address, amount)
			await nfty.connect(addr1).approve(stakeUpgraded.address, amount)
			await stake.connect(addr1).stakeTokens(amount)

			let amount3 = (await stakeUpgraded.StakersData(addr1.address))
				.amount
			expect(amount3).to.equal(getAmount(300))
		})
	})
})
