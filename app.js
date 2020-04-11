let Client = require('ssh2-sftp-client');
let sftp = new Client();

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const credentials = {
    "installed": {
        "client_id": "300561756525-32tmrrcml0jknf2h2vdm11tr70fc4ofq.apps.googleusercontent.com", "project_id": "inventory01", "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token", "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs", "client_secret": "OKV-RY3Y0_aNDfEmFFjViUS9", "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"]
    }
}
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';



(async function main() {
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
            sftp.get('' + row.name, fs.createWriteStream('./' + row.name));
            storeFiles(auth, './' + row.name, data.length)
        });
    }).catch(err => {
        console.log(err, 'catch error');
    });
}

var count = 0;
async function storeFiles(auth, File_Name, total_file) {
    const drive = google.drive({ version: 'v3', auth });
    var fileMetadata = {
        'name': File_Name.replace("./", ""),
        'mimeType': 'application/vnd.google-apps.spreadsheet'
    };
    setTimeout(async function () {
        var media = {
            mimeType: 'application/vnd.ms-excel',
            body: fs.createReadStream(File_Name)
        };
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
            console.log("end");
            // sftp.end();
        }
    }, 10000);
}