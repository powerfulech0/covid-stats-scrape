import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const fetchCovidData = async () => {
  const url = 'https://www.coronavirus.in.gov/map/covid-19-indiana-universal-report-current-public.json';

  try {
    const response = await fetch(url);
    const json = await response.json();

    const {
      county,
      daily_delta_cases: newPositiveCases,
      m3b_covid_positive_test_valid_moving_mean: positivityAllTests,
      daily_delta_deaths: newDeaths,
    } = json.metrics.daily_statistics;

    const johnsonCoIndex = county.findIndex((c) => c === 'Johnson');

    return {
      indiana: {
        // lets not modify the original array
        newPositiveCases: String([...newPositiveCases].pop()),
        positivityAllTests: String([...positivityAllTests].pop()),
        newDeaths: String([...newDeaths].pop()),
      },
      johnson: {
        newPositiveCases: String(newPositiveCases[johnsonCoIndex]),
        positivityAllTests: String(positivityAllTests[johnsonCoIndex]),
        newDeaths: String(newDeaths[johnsonCoIndex]),
      },
    };
  } catch (err) {
    throw new Error(err);
  }
};

const sendEmailUpdate = async (data) => {
  const {
    SENDINBLUE_HOST: host,
    SENDINBLUE_PORT: port,
    SENDINBLUE_USER: user,
    SENDINBLUE_PASS: pass,
    EMAIL_ADDRESS: emailToSendTo,
  } = process.env;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  const prepareStatSection = (heading) => {
    const header = `${heading}\n`;

    const labels = [
      'New Positive Cases',
      'Positivity All Tests',
      'New Deaths',
    ];

    const dataStringArray = Object.values(data[heading.toLowerCase()])
      .map((d, index) => `${labels[index]}: ${index === 1 ? `${d}%` : d}\n`);

    return `${header}${dataStringArray.join('')}`;
  };

  const emailString = `${prepareStatSection('Indiana')}\n${prepareStatSection('Johnson')}`;

  const info = await transporter.sendMail({
    from: '"ReportBot" <reportbot@script.com>', // sender address
    to: `${emailToSendTo}`, // list of receivers
    subject: `COVID Info for ${new Date().toDateString()}`, // Subject line
    text: emailString, // plain text body
  });

  console.log('Message sent: %s', info.messageId);
};

const main = async () => {
  try {
    const results = await fetchCovidData();
    await sendEmailUpdate(results);
  } catch (err) {
    console.error(err);
  }
};

main();
