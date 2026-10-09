# Gihanjigi (기한지기)

English | [简体中文](README.zh-CN.md)

Gihanjigi is a web prototype for people in Korea who have just lost money to fraud. It lays out what to do right
now, which statutory deadlines apply, and which evidence to hand to the bank and the police. The interface is in
Korean, and the procedures and deadlines follow Korean law.

> Gihanjigi is not legal advice. It shows the general procedure for the conditions the user picks, cites the
> article each step relies on, and marks anything the law alone cannot settle as "needs checking" instead of
> guessing a date. The rules have not yet been reviewed by a lawyer.

## What it does

| Screen | What it does |
|---|---|
| Fraud type | A few questions (why the money was sent, how, whether the other party is a relative) sort the case into voice phishing, trade fraud, or a type not yet covered, with the articles behind the decision. Two sample cases can be loaded |
| To do now | Steps for that type in the order they should happen right after the loss, each with its computed deadline where one applies |
| Deadlines | Enter the dates from the notices received and the statutory deadlines are computed. Each one shows the calculation, notes and the cited article, and upcoming deadlines can be downloaded as a calendar file (.ics) |
| Case record | Reads KakaoTalk chat exports (phone, PC and Mac formats) and bank transaction CSVs into a timeline. Lines that show an amount or an account number are flagged for the user to confirm or correct. The whole case can be saved to and restored from a file |
| Progress | Shows where the bank refund procedure and the criminal investigation stand, based on the dates entered |
| Evidence list | Builds separate lists for the bank and for the police from confirmed records only, ready to print or copy |

Every deadline rule cites its article, with a link to the Korean National Law Information Center. On 2026-10-09 the
cited articles were checked against the official text: the version in force, or for the repealed Prosecutors' Office
Act, its last version before repeal.

## Privacy

Case records stay in the browser's localStorage on the user's device. Nothing is sent to a server, and there are
no analytics. The page's Content Security Policy (`connect-src 'none'`, `form-action 'none'`) makes the browser
block any outbound request. All sample data is made up.

## Run

Use Node 24.10.0. The app and the rule engine have no dependencies.

    npm start                 # http://127.0.0.1:4310/
    # http://127.0.0.1:4310/?today=2026-10-09   pins the reference date

## Test

    npm ci
    npm test                  # 71 engine tests (node:test)
    npm run check:browser     # flow checks and axe at 320px, 390px and 1280px
    npm run verify            # both

The browser check uses `playwright-core` and `axe-core` and does not download a browser. Pass the path to Chromium or
Chrome in the `CHROMIUM` environment variable. GitHub Actions uses the Google Chrome installed on the runner.

## Deploy

`src/` is uploaded as is to Cloudflare Pages, and `src/_headers` adds the security headers. A deploy happens only
when someone runs the `deploy` workflow by hand on `main` in GitHub Actions. The one-time setup and the required
secrets are described in [`docs/배포.md`](docs/배포.md) (Korean).

## Layout

    src/engine/   Rule engine. Runs unchanged in the browser and in Node.
      holidays.mjs   Public holidays for 2026 and 2027 (estimated lunar dates are marked) and bank holidays
      dates.mjs      Period arithmetic (first day excluded, month periods, end of month, business days)
      law.mjs        Cited articles, summaries, check status and links to the National Law Information Center
      classify.mjs   Fraud type questions and rules
      deadlines.mjs  11 deadline rules
      checklist.mjs  What to do now, by fraud type
      stages.mjs     Bank refund and investigation stages
      evidence.mjs   KakaoTalk and bank statement parsing, evidence lists
      ics.mjs        Calendar files (.ics)
      case.mjs       Saving and loading a case
    src/ui/       Screens in plain JavaScript on top of the engine
    src/_headers  Security headers for Cloudflare Pages
    test/         Engine tests
    scripts/      Static server and browser check
    docs/         Design notes and deployment guide (Korean)

## Project rules

Working rules are in [`CLAUDE.md`](CLAUDE.md) (Korean). In short: case records never leave the user's device, and
every deployment or paid API call needs explicit approval.
