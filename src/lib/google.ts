import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"],
});

export const sheets = google.sheets({ version: "v4", auth });
export const drive = google.drive({ version: "v3", auth });

export async function readMasterSheet(range = "Creators!A2:Z") {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range });
  return response.data.values ?? [];
}

export async function updateMasterSheet(range: string, values: string[][]) {
  return sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range, valueInputOption: "USER_ENTERED", requestBody: { values } });
}
