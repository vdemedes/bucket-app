'use strict';

/**
 * Dependencies
 */

import Promise from 'pinkie-promise';
import url from 'url-join';

import Model from './base';


/**
 * User
 */

const User = Model.extend({

}, {
	find: function (username) {
		if (!username) {
			throw new Error('Expected a username in User.find()');
		}

		return new Promise((resolve, reject) => {
			this.rootRef
				.child('users')
				.orderByChild('username')
				.equalTo(username)
				.once('child_added', snapshot => {
					let data = snapshot.val();

					let user = new User({
						profileImageURL: data.profileImageURL,
						displayName: data.displayName,
						username: data.username,
						email: data.email,
						id: snapshot.key()
					}, {
						ref: snapshot.ref()
					});

					resolve(user);
				});
		});
	},

	currentUser: function () {
		let authData = this.rootRef.getAuth();

		if (!authData) {
			return null;
		}

		return new User({
			profileImageURL: authData.github.profileImageURL,
			displayName: authData.github.displayName,
			username: authData.github.username,
			email: authData.github.email,
			id: authData.uid
		});
	},

	isLoggedIn: function () {
		return !!this.currentUser();
	},

	isInvited: function (username) {
		if (!username) {
			throw new Error('Expected a username in User.isInvited()');
		}

		return new Promise(resolve => {
			this.rootRef.child('invites').once('value', snapshot => {
				let invites = snapshot.val() || {};
				let isInvited = !!invites[username];

				resolve(isInvited);
			});
		});
	},

	logIn: function () {
		if (this.isLoggedIn()) {
			return Promise.resolve(this.currentUser());
		}

		return new Promise((resolve, reject) => {
			this.rootRef.authWithOAuthPopup('github', err => {
				if (err) {
					reject(err);
					return;
				}

				let user = this.currentUser();

				this.rootRef.child(url('users', user.get('id'))).set(user.toJSON(), err => {
					if (err) {
						reject(err);
						return;
					}

					this.rootRef.child(url('usernames', user.get('id'))).set(user.get('username'));

					this.isInvited(user.get('username'))
						.catch(reject)
						.then(isInvited => {
							if (!isInvited) {
								let err = new Error('User is not invited');
								reject(err);
								return;
							}

							resolve(user);
						});
				});
			});
		});
	},

	logOut: function () {
		this.rootRef.unauth();
	}
});


/**
 * Expose model
 */

export default User;
