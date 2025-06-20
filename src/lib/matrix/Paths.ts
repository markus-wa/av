import type HomerunMatrixSwitcher from '$lib/matrix/HomerunMatrixSwitcher';

/*
nSwitches=0
1 = A
2 = B
3 = A
4 = B
...

Then

nSwitches=1
1 = B
2 = A
3 = B
4 = A
...

Repeat
 */
export async function pathABAB(matrixSwitcher: HomerunMatrixSwitcher, nSwitches: number): Promise<void> {
	const a = (nSwitches % 2) + 1;
	const b = ((nSwitches + 1) % 2) + 1;

	for (let i = 0; i < 16; i++) {
		await matrixSwitcher.setPath(i%2 === 0 ? a : b, i + 1);
	}
}

/*
nSwitches=0
1 = A
2 = A
3 = B
4 = B
...

Then

nSwitches=1
1 = B
2 = B
3 = A
4 = A
...

Repeat
 */
export async function pathAABBAABB(matrixSwitcher: HomerunMatrixSwitcher, nSwitches: number): Promise<void> {
	const a = (nSwitches % 2) + 1;
	const b = ((nSwitches + 1) % 2) + 1;

	for (let i = 0; i < 16; i++) {
		await matrixSwitcher.setPath(i%4 < 2 ? a : b, i + 1);
	}
}

/*
Random assignment of each output to A or B
 */
export async function pathRandomAll(matrixSwitcher: HomerunMatrixSwitcher): Promise<void> {
	for (let i = 0; i < 16; i++) {
		await matrixSwitcher.setPath(Math.floor(Math.random() * 2) + 1, i + 1);
	}
}

/*
Random assignment of some (random) outputs to A or B
 */
export async function pathRandomSome(matrixSwitcher: HomerunMatrixSwitcher): Promise<void> {
	for (let i = 0; i < 16; i++) {
		if (Math.random() < 0.5) {
			await matrixSwitcher.setPath(Math.floor(Math.random() * 2) + 1, i + 1);
		}
	}
}

/*
nSwitches=0
1 = A
2 = A
3 = A
4 = A
...

Then

nSwitches=1
1 = B
2 = B
3 = B
4 = B
...
 */
export async function pathCycleAB(matrixSwitcher: HomerunMatrixSwitcher, nSwitches: number): Promise<void> {
	const input = (nSwitches % 2) + 1;

	for (let i = 0; i < 16; i++) {
		await matrixSwitcher.setPath(input, i + 1);
	}
}
