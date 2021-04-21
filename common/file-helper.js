import fs from 'fs';
import { Observable } from "rxjs/index.js";

function writeFileRx(fileName, data, options = null) {
	return new Observable((observer) => {
		fs.writeFile(fileName, data, options, (err) => {
			if (err) {
				observer.error(err);
			} else {
				observer.next(data);
			}
		})
	})
}


function readFileRx(path) {
	return new Observable((observer) => {
		fs.readFile(path, (err, result) => {
			if (err) {
				observer.error(err);
			} else {
				const data = JSON.parse(result);
				observer.next(data)
			}
		})
	})
}


export { writeFileRx, readFileRx };
