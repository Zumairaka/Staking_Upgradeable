const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { ethers, upgrades } = require('hardhat')

describe('NFTY ERC-20 token contract', () => {
	let NFTY, nfty, owner, addr1, addr2
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

	beforeEach(async () => {
		NFTY = await ethers.getContractFactory('NFTYToken')
		nfty = await NFTY.deploy()
		await nfty.initialize()
		;[owner, addr1, addr2] = await ethers.getSigners()
	})

	describe('Initializer', () => {
		it('Should revert if it tries to call the initializer again', async () => {
			await expect(nfty.initialize()).to.be.revertedWith(
				'Initializable: contract is already initialized'
			)
		})
	})

	describe('Deployment', () => {
		it('Should return the total supply properly', async () => {
			let totalSupply = BigNumber.from(50000).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)
			expect(await nfty.totalSupply()).to.equal(totalSupply)
		})

		it('Should assign the total supply to the nfty owner', async () => {
			expect(await nfty.balanceOf(await nfty.owner())).to.equal(
				await nfty.totalSupply()
			)
		})
	})

	describe('Ownership', () => {
		it('Should return the correct owner', async () => {
			expect(await nfty.owner()).to.equal(owner.address)
		})

		it('Should renounce the ownership properly', async () => {
			await nfty.renounceOwnership()
			expect(await nfty.owner()).to.equal(ZERO_ADDRESS)
		})

		it('Should transfer the ownership properly', async () => {
			await nfty.transferOwnership(addr1.address)
			expect(await nfty.owner()).to.equal(addr1.address)
		})

		it('Should revert if trnasfer ownership is not done by the owner', async () => {
			await expect(
				nfty.connect(addr1).transferOwnership(addr2.address)
			).to.be.revertedWith('Ownable: caller is not the owner')
		})

		it('Should revert if renounce ownership is not done by the owner', async () => {
			await expect(
				nfty.connect(addr1).renounceOwnership()
			).to.be.revertedWith('Ownable: caller is not the owner')
		})
	})

	describe('Meta data', () => {
		it('Should return the name of token properly', async () => {
			let name = 'NFTY Token'
			expect(await nfty.name()).to.equal(name)
		})

		it('Should return the symbol properly', async () => {
			let symbol = 'NFTY'
			expect(await nfty.symbol()).to.equal(symbol)
		})

		it('Should return the decimal properly', async () => {
			let decimal = 18
			expect(await nfty.decimals()).to.equal(decimal)
		})
	})

	describe('Transfer', () => {
		it('Should revert if the recipient is zero address', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)
			await expect(
				nfty.transfer(ZERO_ADDRESS, amount)
			).to.be.revertedWith('ERC20: transfer to the zero address')
		})

		it('Should revert if the balance of sender is less than the amount', async () => {
			let amount = BigNumber.from(50001).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)
			await expect(
				nfty.connect(owner).transfer(addr1.address, amount)
			).to.be.revertedWith('ERC20: transfer amount exceeds balance')
		})

		it('Should transfer the amount properly', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)
			let ownerBalance = await nfty.balanceOf(owner.address)

			await nfty.connect(owner).transfer(addr1.address, amount)
			expect(await nfty.balanceOf(addr1.address)).to.equal(amount)

			let ownerNewBalance = BigNumber.from(ownerBalance).sub(
				BigNumber.from(amount)
			)
			expect(await nfty.balanceOf(owner.address)).to.equal(
				ownerNewBalance
			)
		})
	})

	describe('Allowance', () => {
		it('Should allocate the allowance to the user properly', async () => {
			await nfty.connect(addr1).approve(addr2.address, 100)

			expect(await nfty.allowance(addr1.address, addr2.address)).to.equal(
				100
			)
		})

		it('Should be able to increase the allowance', async () => {
			await nfty.connect(addr1).approve(addr2.address, 100)
			await nfty.connect(addr1).increaseAllowance(addr2.address, 100)

			expect(await nfty.allowance(addr1.address, addr2.address)).to.equal(
				200
			)
		})

		it('Should be able to decrease the allowance', async () => {
			await nfty.connect(addr1).approve(addr2.address, 100)
			await nfty.connect(addr1).decreaseAllowance(addr2.address, 50)

			expect(await nfty.allowance(addr1.address, addr2.address)).to.equal(
				50
			)
		})

		it('Should revert when decreasing the allowance beyond zero', async () => {
			await nfty.connect(addr1).approve(addr2.address, 100)
			await expect(
				nfty.connect(addr1).decreaseAllowance(addr2.address, 150)
			).to.be.revertedWith('ERC20: decreased allowance below zero')
		})
	})

	describe('Approve', () => {
		it('Should revert if the approval request is to the zero address', async () => {
			await expect(
				nfty.connect(addr1).approve(ZERO_ADDRESS, 100)
			).to.be.revertedWith('ERC20: approve to the zero address')
		})

		it('Should approve properly', async () => {
			await nfty.connect(addr1).approve(addr2.address, 100)

			expect(await nfty.allowance(addr1.address, addr2.address)).to.equal(
				100
			)
		})
	})

	describe('Transfer From', () => {
		it('Should revert if approval is not given for the transfer', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			await nfty.connect(owner).transfer(addr1.address, amount)

			await expect(
				nfty
					.connect(addr2)
					.transferFrom(addr1.address, addr2.address, amount)
			).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
		})

		it('Should revert if the sender is zero address', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			await nfty.connect(owner).transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(addr2.address, amount)

			await expect(
				nfty
					.connect(addr2)
					.transferFrom(ZERO_ADDRESS, addr2.address, amount)
			).to.be.revertedWith('ERC20: transfer from the zero address')
		})

		it('Should revert if the receiver is zero address', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			await nfty.connect(owner).transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(addr2.address, amount)

			await expect(
				nfty
					.connect(addr2)
					.transferFrom(addr1.address, ZERO_ADDRESS, amount)
			).to.be.revertedWith('ERC20: transfer to the zero address')
		})

		it('Should revert if the transfer amount exceeds balance', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)
			let newAmount = BigNumber.from(150).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			await nfty.connect(owner).transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(addr2.address, amount)

			await expect(
				nfty
					.connect(addr2)
					.transferFrom(addr1.address, addr2.address, newAmount)
			).to.be.revertedWith('ERC20: transfer amount exceeds balance')
		})

		it('Should transfer amount between two accounts properly', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)
			let transferAmount = BigNumber.from(50).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			await nfty.connect(owner).transfer(addr1.address, amount)
			await nfty.connect(addr1).approve(addr2.address, amount)
			await nfty
				.connect(addr2)
				.transferFrom(addr1.address, addr2.address, transferAmount)

			expect(await nfty.balanceOf(addr1.address)).to.equal(transferAmount)
			expect(await nfty.balanceOf(addr2.address)).to.equal(transferAmount)
		})
	})

	describe('Mint', () => {
		it('Should revert if minting is not done by the owner', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			await expect(
				nfty.connect(addr1).mint(addr1.address, amount)
			).to.be.revertedWith('Ownable: caller is not the owner')
		})

		it('Should mint the token properly to the account specified', async () => {
			let amount = BigNumber.from(100).mul(
				BigNumber.from(10).pow(await nfty.decimals())
			)

			let totalSupply = await nfty.totalSupply()
			await nfty.connect(owner).mint(addr1.address, amount)
			let newTotalSupply = BigNumber.from(totalSupply).add(amount)

			expect(await nfty.balanceOf(addr1.address)).to.equal(amount)
			expect(await nfty.totalSupply()).to.equal(newTotalSupply)
		})
	})
})
