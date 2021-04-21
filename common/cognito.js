import AWS from 'aws-sdk';
import { from, Observable } from "rxjs/index.js";

import { AWS_CONFIG } from "./config.js";


AWS.config.update({...AWS_CONFIG})

const cognito = new AWS.CognitoIdentityServiceProvider();

/**
 * Create function to delete user from user pool.
 *
 * @param userPoolId User Pool Id.
 * @return {function(*): Observable<any>}
 */
export function createUserDeletion(userPoolId) {
	/**
	 * Remove user from user pool.
	 */
	return function(userId) {
		return from(
			cognito.adminDeleteUser({
				UserPoolId: userPoolId,
				Username: userId,
			}).promise()
		);
	}
}
