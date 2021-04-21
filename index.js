import express from 'express';
import { cognitoUserDeletion } from "./user-deletion.engine.js";

const app = express();
const port = 3000;


cognitoUserDeletion.run();
// cognitoUserDeletion.revertUsersList();
//

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
});
