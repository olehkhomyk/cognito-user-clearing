import { forkJoin, from, combineLatest, of } from "rxjs/index.js";
import {
	catchError,
	concatMap, delay,
	map,
	switchMap,
	toArray
} from "rxjs/operators/index.js";
import { readFileRx, writeFileRx } from "./common/file-helper.js";
import { USER_POOL_ID } from "./common/config.js";
import { createUserDeletion } from "./common/cognito.js";

const removeUser = createUserDeletion(USER_POOL_ID);

const requestDelay = 0;

export class CognitoUserDeletion {
	usersToDelete = [];
	alreadyDeletedUsersCollection = {};

	deletingSubscription;
	rebootDeletingSubscription;

	maxAlreadyDeletedUsers = 50;

	get deletedUsersCount() {
		return Object.keys(this.alreadyDeletedUsersCollection).length;
	}

	isTimeToCleanUsers() {
		return this.deletedUsersCount > this.maxAlreadyDeletedUsers;
	}

	constructor() {
	}

	run() {
		this.startDeletingProcessParallel();
	}

	revertUsersList() {
		console.log(`Reverse process started.`);

		readFileRx('records/existence_users.json').pipe(
			map(({ Users }) => Users.reverse()),
			switchMap((Users) => writeFileRx('records/existence_users.json', JSON.stringify({Users})))
		).subscribe(() => {
			console.log(`User list successfully reversed and saved.`);
		})
	}

	startDeletingProcess() {
		this.deletingSubscription = this.loadUsers().pipe(
			switchMap((users) =>
				from(users).pipe(
					concatMap(({Username, index}) => {
						console.log(Username, 'started deleting');
						return this.removeUser(Username)
					})
				)
			)
		).subscribe((el) => {
			console.log(el, 'Successfully deleted')

			if (this.isTimeToCleanUsers()) {
				this.restartDeletingProcess();
			}
		});
	}

	startDeletingProcessParallel() {
		this.deletingSubscription = this.loadUsers().pipe(
			map((users) => {
				let i, j, tempArray, chunk = 10;
				const chunkedArr = [];

				for (i = 0, j = users.length; i < j; i += chunk) {
					tempArray = users.slice(i, i + chunk);

					chunkedArr.push(tempArray);
				}

				return chunkedArr;
			}),
			switchMap((usersChunks) =>
				from(usersChunks).pipe(
					concatMap((users) => {
						return forkJoin(users.map(({Username}) => this.removeUser(Username))).pipe(
							delay(requestDelay)
						)
					})
				)
			)
		).subscribe((el) => {
			console.log(el, 'Successfully deleted')

			if (this.isTimeToCleanUsers()) {
				console.log(`-------------------- New ${this.maxAlreadyDeletedUsers} of already created users, adding and clearing --------------------`);

				this.restartDeletingProcess(true);
			}
		});
	}

	restartDeletingProcess(parallel) {
		if (this.deletingSubscription) {
			this.deletingSubscription.unsubscribe();
		}

		if (this.rebootDeletingSubscription) {
			this.rebootDeletingSubscription.unsubscribe();
		}

		this.rebootDeletingSubscription = this.saveDeletedUserList().pipe(
			switchMap(() => this.cleanDeletedUsers())
		).subscribe(() => {
			this.alreadyDeletedUsersCollection = {};

			if (parallel) {
				this.startDeletingProcessParallel();
			} else {
				this.startDeletingProcess()
			}
		});
	}

	removeUser(id) {
		return removeUser(id).pipe(
			delay(requestDelay),
			map(() => id),
			catchError((err) => {
				if (err.code === 'UserNotFoundException') {
					this.collectFailedUser(id);
					console.log(`User with id: ${id} was already deleted, and added to deleted list`);
				} else if (err.code === 'ExpiredTokenException') {
					console.log('Token is expired')
				} else {
					console.log('error: ', err.code)
				}

				return of(null)
			})
		);
	}

	/**
	 * Collect failed (already deleted users) users.
	 *
	 * @param userId
	 */
	collectFailedUser(userId) {
		this.alreadyDeletedUsersCollection[userId] = true;
	}

	saveDeletedUserList() {
		if (Object.keys(this.alreadyDeletedUsersCollection).length) {
			return writeFileRx('records/alreadyDeletedUsers.json', JSON.stringify({failed: this.alreadyDeletedUsersCollection}))
		}

		return of(null);
	}

	/**
	 * Leaves just not deleted users.
	 */
	cleanDeletedUsers() {
		const existenceUsers$ = combineLatest([
			readFileRx('records/existence_users.json'),
			readFileRx('records/alreadyDeletedUsers.json')
		]).pipe(
			// skipWhile(([existenceUsers, alreadyDeletedUsers]) => !Object.keys(alreadyDeletedUsers.failed).length),
			map(([existenceUsers, alreadyDeletedUsers]) =>
				existenceUsers.Users.filter(({Username}) => !alreadyDeletedUsers.failed[Username])
			),
			switchMap((users) => writeFileRx('records/existence_users.json', JSON.stringify({Users: users})))
		)

		// existenceUsers$.subscribe((users) => {
			// this.usersToDelete = users;
		// })

		return existenceUsers$;
	}

	/**
	 * Load all users list.
	 */
	loadUsers() {
		const users$ = readFileRx('records/existence_users.json').pipe(
			switchMap(({Users}) =>
				from(Users).pipe(
					map(({Username}, index) => ({Username, index})),
					toArray()
				)
			)
		);

		users$.subscribe((users) => {
			this.usersToDelete = users;
		})

		return users$;
	}
}


export const cognitoUserDeletion = new CognitoUserDeletion();






