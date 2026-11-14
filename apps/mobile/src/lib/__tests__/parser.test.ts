import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categorize, dedupeKey, parseCsvStatement, parseSms, splitMessages } from '../parser.ts';
import { dayBudget, gradeFor, type Profile } from '../budget.ts';

const NOW = new Date(2026, 10, 15, 18, 0);

const cases: [string, number, string, string][] = [
  ['Rs.250.00 debited from A/c XX1234 on 15-11-26 to VPA starbucks.blr@hdfcbank (UPI Ref No 6123). Avl Bal Rs 45,000.00', 250, 'Starbucks Blr', 'food'],
  ['INR 600.00 spent on HDFC Bank Card XX1234 at BLINKIT on 2026-11-15:13:22:10. Avl Lmt: INR 1,20,000', 600, 'Blinkit', 'grocery'],
  ['Your a/c no. XXXXXXXX1234 is debited for Rs.500.00 on 15-11-2026 and credited to SWIGGY (UPI Ref no 432)', 500, 'Swiggy', 'food'],
  ['Sent Rs.400.00 From HDFC Bank A/C *1234 To ZEPTO MARKETPLACE On 15/11/26 Ref 5321', 400, 'Zepto Marketplace', 'grocery'],
  ['Dear UPI user A/C X1234 debited by 2450.0 on date 15Nov26 trf to AMAZON PAY Refno 987 -SBI', 2450, 'Amazon Pay', 'shopping'],
  ['Rs 300 sent to 9876543210@ybl on 15-11-26', 300, 'UPI Transfer', 'upi'],
  ['Rs.199 debited for NETFLIX autopay on 14-11-26', 199, 'Netflix', 'subs'],
];

for (const [sms, amt, merchant, category] of cases) {
  test(`sms: ${merchant}`, () => {
    const r = parseSms(sms, NOW)!;
    assert.equal(r.ok, true);
    assert.equal(r.amount, amt);
    assert.equal(r.merchant, merchant);
    assert.equal(r.category, category);
  });
}

test('credit sms is skipped', () => {
  const r = parseSms('Rs.50000.00 credited to your A/c XX1234 on 14-11-26 by NEFT SALARY', NOW)!;
  assert.equal(r.ok, false);
  assert.equal(r.type, 'credit');
});

test('balance amount is not mistaken for txn amount', () => {
  const r = parseSms('Avl Bal Rs 9,999.00. Rs.120 debited at CHAI POINT on 15-11-26', NOW)!;
  assert.equal(r.amount, 120);
});

test('short keywords use word boundaries', () => {
  assert.equal(categorize('Coca Cola store'), 'other');   // not "ola"
  assert.equal(categorize('Premium tailors'), 'other');   // not "emi"
  assert.equal(categorize('OLA CABS'), 'travel');
});

test('splits multi-line pastes', () => {
  assert.equal(splitMessages('Rs.10 debited at A on 1-1-26\nRs.20 debited at B on 1-1-26').length, 2);
});

test('csv statement (HDFC style)', () => {
  const csv = `Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/11/26,UPI-SWIGGY-swiggy@icici-ICIC0000001-6123-Payment,000,01/11/26,"1,250.00",,10000
02/11/26,POS 4111XXXX1234 AMAZON PAY INDIA,000,02/11/26,999.00,,9000
03/11/26,NEFT CR-SALARY,000,03/11/26,,100000.00,109000`;
  const r = parseCsvStatement(csv, NOW);
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.items.map((i) => [i.merchant, i.amount, i.category]), [['Swiggy', 1250, 'food'], ['Amazon Pay', 999, 'shopping']]);
});

test('dedupe key is stable', () => {
  const a = dedupeKey({ amount: 250, merchant: 'Starbucks', occurredAt: NOW.getTime() }, 'sms');
  const b = dedupeKey({ amount: 250, merchant: 'starbucks', occurredAt: NOW.getTime() }, 'sms');
  assert.equal(a, b);
});

test('budget: 1 lakh / 30 days = 3333', () => {
  const p = { monthly_income: 100000, fixed_costs: 0, budget_mode: 'full', rollover: false, created_at: NOW.toISOString() } as Profile;
  assert.equal(Math.round(dayBudget(p, [], NOW).total), 3333);
});

test('grade for 4200 vs 3333 is C', () => {
  assert.equal(gradeFor(4200, 3333.33).grade, 'C');
});

test('csv with Cr/Dr type column', () => {
  const r = parseCsvStatement('Date,Description,Amount,Cr/Dr\n07/11/2026,UBER TRIP,320.50,DR\n08/11/2026,INTEREST,12.00,CR\n', NOW);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].amount, 320.5);
  assert.equal(r.items[0].category, 'travel');
});
