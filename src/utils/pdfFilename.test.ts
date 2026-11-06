import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePdfFilename, buildExportFilename } from './pdfFilename.ts';

test('Strict Zero-Underscore Rule: Replaces all underscores in dirty filenames', () => {
  const dirtyCases = [
    { input: 'Green_Valley_Farming_Batch_04_Report_2026_11_06', expectedEndsWith: '.pdf' },
    { input: 'Apex_Ventures_Runway_Plan_Q4__Final', expectedEndsWith: '.pdf' },
    { input: 'Credit_Sale__Invoice_CSALE_901_John_Doe.PDF', expectedEndsWith: '.pdf' },
    { input: '___Leading_and_Trailing___Underscores___', expectedEndsWith: '.pdf' },
    { input: 'Normal Name With Spaces And_Underscore.pdf', expectedEndsWith: '.pdf' },
    { input: 'Special!@#$%^&*()_Characters_File_Name', expectedEndsWith: '.pdf' },
  ];

  for (const tc of dirtyCases) {
    const clean = sanitizePdfFilename(tc.input);
    assert.ok(
      !clean.includes('_'),
      `Failed! Filename "${clean}" must NOT contain underscores. Original was "${tc.input}"`
    );
    assert.ok(
      clean.endsWith(tc.expectedEndsWith),
      `Failed! Filename "${clean}" must end with ${tc.expectedEndsWith}`
    );
    assert.ok(!clean.includes('--'), `Failed! Consecutive hyphens not collapsed in "${clean}"`);
  }
});

test('buildExportFilename: Constructs clean hyphenated names with zero underscores', () => {
  const filename1 = buildExportFilename({
    orgName: 'Green_Valley_Agro',
    documentType: 'Batch_Report',
    entityName: 'Broilers_Batch_04',
    date: '2026-11-06',
  });

  assert.equal(filename1, 'Green-Valley-Agro-Batch-Report-Broilers-Batch-04-2026-11-06.pdf');
  assert.ok(!filename1.includes('_'), 'Filename must not have underscores');

  const filename2 = buildExportFilename({
    orgName: 'Apex & Partners (Pvt) Ltd.',
    documentType: 'Runway Planning Variance',
    entityName: 'Expansion Phase #1',
    date: new Date('2026-11-06T10:00:00Z'),
  });

  assert.equal(filename2, 'Apex-Partners-Pvt-Ltd.-Runway-Planning-Variance-Expansion-Phase-1-2026-11-06.pdf');
  assert.ok(!filename2.includes('_'), 'Filename must not have underscores');
});

test('sanitizePdfFilename: Gracefully handles empty or degenerate inputs', () => {
  assert.equal(sanitizePdfFilename(''), 'Agro-Planner-Document.pdf');
  assert.equal(sanitizePdfFilename('___'), 'Agro-Planner-Document.pdf');
  assert.equal(sanitizePdfFilename('///'), 'Agro-Planner-Document.pdf');
  assert.ok(!sanitizePdfFilename('').includes('_'));
});

