import { app, client } from "../../index";
import { hoursAirtable } from "../../lib/airtable";
import logger from "../../util/Logger";
import { getHoursUsers } from "../airtable/getHoursUsers";
import { getVerifiedUsers } from "../airtable/getVerifiedUsers";
import { sendAlreadyVerifiedDM, sendVerificationDM } from "../sendStuff";
import { upgradeSlackUser } from "../upgradeSlackUser";

export async function checkUserHours() {
  let USERS = await getHoursUsers();
  let usersWithMoreThanMinimumHours = USERS.filter((user) => {
    let minutesApproved = Number(user["Minutes (Approved)"] ?? 0);
    return minutesApproved / 60 >= 3;
  });

  let tmp = await getVerifiedUsers();

  // make an array of 'Hack Club Slack ID's
  let verifiedUsers = tmp.map((user) => user["Hack Club Slack ID"]);

  // check if the user has minimumHoursConfirmed === true
  // if not, send them a DM
  if (usersWithMoreThanMinimumHours.length > 0) {
    usersWithMoreThanMinimumHours.forEach(async (user) => {
      if (user["verificationDmSent"] === true && user["isFullUser"] === true) {
        return;
      } else {
        if (user["isFullUser"] === true) {
          return;
        } else {
          if (user["verificationDmSent"] !== true) {
            if (verifiedUsers.includes(user["Slack ID"]) &&
              user["verificationDmSent"]) {
              await sendAlreadyVerifiedDM(
                app.client,
                user["Slack ID"],
                user["Internal ID"]
              ).then(() => {
                upgradeSlackUser(client, user["Slack ID"]);
              });
            } else {
              await sendVerificationDM(app.client, user["Slack ID"]);
            }

            try {
              const userRec = await hoursAirtable
                .select({
                  filterByFormula: `{Slack ID} = '${user["Slack ID"]}'`,
                  pageSize: 1,
                })
                .firstPage();

              await hoursAirtable.update(userRec[0].id, {
                verificationDmSent: true,
              });
            } catch (err) {
              logger(`Error updating user: ${err}`, "error");
            }
          } else {
            return;
          }
        }
      }
    });
  }
}
