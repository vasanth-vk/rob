let Client = require('ssh2-sftp-client');
let sftp = new Client();

const fs = require('fs-extra');
const readline = require('readline');
const { google } = require('googleapis');
const csv = require('csv-parser');

var sheetId = '1VRP7E5z5KAi6QTHzqCL5RmfCdel80iucVgE8S2wzzDQ';
var folder = '1ziXBU98_Rk0ZEa-T-5HPEexIzhZi-0B-';

const credentials = { "installed": { "client_id": "24603474485-3krnmbhck86r2nim6agr4tjamqbibnvi.apps.googleusercontent.com", "project_id": "fleacircus", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "WzlsGubobwxRLi6N9jHtdB-l", "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"] } }
const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';



(async function main() {
    console.log("````````````````````````````````Starting``````````````````````````````")
    authorize(credentials, getFiles);

})();

function authorize(credentials, callback) {

    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
            return getAccessToken(oAuth2Client, callback);

        }
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);

            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
            });
            callback(oAuth2Client);
        });
    });
}


function getFiles(auth) {
    sftp.connect({
        host: 'sftp.neto.com.au',
        port: '2022',
        username: 'FPProductData',
        password: 'N1e9WSRyKxh7A5lb'
    }).then(() => {
        return sftp.list('/');
    }).then(data => {
        data.forEach(function (row) {
            //console.log(row)
            sftp.get('' + row.name, fs.createWriteStream('/tmp/' + row.name));
            storeFiles(auth, '/tmp/' + row.name, data.length)
        });
    }).catch(err => {
        console.log(err, 'catch error');
    });
}

var count = 0;
async function storeFiles(auth, File_Name, total_file) {
    const drive = google.drive({ version: 'v3', auth });
    var fileMetadata = {
        'name': File_Name.replace("/tmp/", "").replace(".csv", "") + " " + new Date().toISOString().replace("Z", "").replace("T", " "),
        'mimeType': 'application/vnd.google-apps.spreadsheet',
        parents: [folder],
    };
    setTimeout(async function () {
        var SourceData = fs.createReadStream(File_Name);
        writefile(auth, SourceData, File_Name);
        var media = {
            mimeType: 'application/vnd.ms-excel',
            body: SourceData
        };
        // await drive.files.list({
        // }, function (err, res) {
        //     if (err) {
        //         console.error(err.data.error);
        //     } else {
        //         res.data.files.forEach(function (file) {
        //             if (file.name == File_Name.replace("/tmp/", "").replace(".csv", "")) {
        //                 drive.files.delete({
        //                     "fileId": file.id
        //                 });
        //             }
        //         });
        //     }
        // });

        await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        }, function (err, file) {
            if (err) {
                console.error(err.data.error);
            } else {
                console.log('File Id: ', file.data.id);
            }
        });
        count++;
        if (total_file == count) {
            console.log("````````````````````````````````END``````````````````````````````")
            try {
                sftp.end();
            } catch (e) {
                console.log("closed")
            }
        }
    }, 10000);
}

function writefile(auth, data, File_Name) {
    var array = [];
    data.pipe(csv())
        .on('data', (row) => {
            array.push(row);
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
            console.log(array.length);
            toWrite(auth, array);
            fs.remove(File_Name)
        });
}
function toWrite(auth, data) {
    if (!data[0]['Image URL']) {
        return;
    }
    //console.log(data)
    const sheets = google.sheets({ version: 'v4', auth });
    sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: 'FleaCircus!A2:Q',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        if (res) {
            sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'FleaCircus!A1:R1',
            }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
                if (res) {
                    //console.log(res.data.values);
                    var header = res.data.values;
                    var values = [];
                    data.forEach(function (row) {
                        var array = [];
                        header[0].forEach(function (item) {
                            if (item.toLowerCase().indexOf('timestamp') > -1 || item.toLowerCase().indexOf('stamp') > -1) {
                                array.push(new Date().toISOString().replace("T", " ").replace("Z", ""));
                            } else {
                                array.push(row[item]);
                            }
                        });
                        values.push(array);
                    });
                    //console.log(values)
                    const resource = {
                        values: values,
                    };
                    sheets.spreadsheets.values.update({
                        spreadsheetId: sheetId,
                        range: 'FleaCircus!A2:Q',
                        valueInputOption: "USER_ENTERED",
                        resource: resource
                    }, (err, res) => {
                        if (err) return console.log('The API returned an error: ' + err);
                        if (res) {
                            console.log(res.statusText);
                        } else {
                            console.log('No data found.');
                        }
                    });

                } else {
                    console.log('No header found.');
                }
            });
        } else {
            console.log('sheet not Clear.');
        }
    });
}