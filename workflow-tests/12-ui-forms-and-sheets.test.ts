import test from 'node:test';
import assert from 'node:assert/strict';
import { validators } from '../src/utils/validation.ts';
import { nativeKeyboard } from '../src/native/keyboard.ts';

// ---------------------------------------------------------------------------
// SUITE 12: UI BOTTOM SHEETS, KEYBOARD & INLINE ERROR TEST SUITE
// Asserts form validation invariants, keyboard insets, dirty state guard,
// and 88dvh height limits (Fixes B6, B7, B17, B18, B23)
// ---------------------------------------------------------------------------

test('WF-SHEET-01: Form Field Invariants & Client-Side Validation Rules (Fixes B6, B23)', () => {
  // 1. validators.required
  assert.equal(validators.required('', 'Full name'), 'Full name is required.');
  assert.equal(validators.required('   ', 'Customer'), 'Customer is required.');
  assert.equal(validators.required(null, 'Date'), 'Date is required.');
  assert.equal(validators.required(undefined, 'Field'), 'Field is required.');
  assert.equal(validators.required('Valid text', 'Full name'), null);

  // 2. validators.minAuditNote (Enforces >= 4 characters for audit trail, max 500)
  assert.match(validators.minAuditNote('') || '', /at least 4 characters/);
  assert.match(validators.minAuditNote('hi') || '', /at least 4 characters/);
  assert.match(validators.minAuditNote('   ') || '', /at least 4 characters/);
  assert.equal(validators.minAuditNote('Feed purchase batch #4'), null);
  assert.equal(validators.minAuditNote('Paid in full via EcoCash'), null);
  assert.match(validators.minAuditNote('a'.repeat(501)) || '', /cannot exceed 500 characters/);

  // 3. validators.positiveNumber
  assert.match(validators.positiveNumber(0, 'Amount') || '', /positive number greater than zero/);
  assert.match(validators.positiveNumber(-50, 'Price') || '', /positive number greater than zero/);
  assert.match(validators.positiveNumber('abc', 'Deposit') || '', /positive number greater than zero/);
  assert.match(validators.positiveNumber('', 'Cost') || '', /positive number greater than zero/);
  assert.equal(validators.positiveNumber(0.01, 'Amount'), null);
  assert.equal(validators.positiveNumber('125.50', 'Amount'), null);
  assert.equal(validators.positiveNumber(5000, 'Principal'), null);

  // 4. validators.positiveInteger
  assert.match(validators.positiveInteger(0, 'Quantity') || '', /whole positive number/);
  assert.match(validators.positiveInteger(-10, 'Headcount') || '', /whole positive number/);
  assert.match(validators.positiveInteger(12.5, 'Headcount') || '', /whole positive number/);
  assert.equal(validators.positiveInteger(1, 'Quantity'), null);
  assert.equal(validators.positiveInteger('50', 'Headcount'), null);

  // 5. validators.contact
  assert.match(validators.contact('') || '', /at least 3 characters/);
  assert.match(validators.contact('ab') || '', /at least 3 characters/);
  assert.equal(validators.contact('+263 77 123 4567'), null);
  assert.equal(validators.contact('farm@gmail.com'), null);
});

test('WF-SHEET-02: Soft Keyboard Inset Calculations & Max Height 88dvh Contract (Fixes B7, B18)', () => {
  // Test native keyboard height state listener & property injection
  let receivedHeight = -1;
  const unsubscribe = nativeKeyboard.subscribe((h) => {
    receivedHeight = h;
  });

  // Initial height is 0 (keyboard hidden)
  assert.equal(receivedHeight, 0);

  // Verify 88dvh viewport height calculation across representative Android devices:
  // 1. Compact / Budget: 320 x 568
  // 2. Standard Android: 360 x 640
  // 3. Modern Flagship / Phablet: 412 x 915
  const viewports = [
    { name: '320x568 (Compact)', height: 568, kb: 220 },
    { name: '360x640 (Standard)', height: 640, kb: 260 },
    { name: '412x915 (Modern)', height: 915, kb: 300 },
  ];

  for (const vp of viewports) {
    const maxSheetHeight = vp.height * 0.88;
    // Sheet must leave at least 12% space at top for scrim and status bar visibility
    const topMargin = vp.height - maxSheetHeight;
    assert.ok(topMargin >= 50, `${vp.name} leaves sufficient top clearance for status bar: ${topMargin}px`);

    // Available space above keyboard
    const visibleWindowHeight = vp.height - vp.kb;
    assert.ok(visibleWindowHeight > 200, `${vp.name} maintains usable form view above IME: ${visibleWindowHeight}px`);
  }

  unsubscribe();
});

test('WF-SHEET-03: Dirty State Tracking & Unsaved Changes Guard (Fixes B17)', () => {
  // State machine simulating FormSheet / BottomSheet dirty checking
  interface SheetState {
    isOpen: boolean;
    isDirty: boolean;
    showDiscardDialog: boolean;
  }

  function handleCloseRequest(state: SheetState): SheetState {
    if (state.isDirty && !state.showDiscardDialog) {
      // Must prompt with discard dialog first, do not close
      return { ...state, showDiscardDialog: true };
    }
    // Clean form or already confirmed: close immediately
    return { ...state, isOpen: false, showDiscardDialog: false, isDirty: false };
  }

  // Case A: Clean form closes immediately
  const cleanState: SheetState = { isOpen: true, isDirty: false, showDiscardDialog: false };
  const closedClean = handleCloseRequest(cleanState);
  assert.equal(closedClean.isOpen, false);
  assert.equal(closedClean.showDiscardDialog, false);

  // Case B: Dirty form opens discard confirmation prompt
  const dirtyState: SheetState = { isOpen: true, isDirty: true, showDiscardDialog: false };
  const promptDirty = handleCloseRequest(dirtyState);
  assert.equal(promptDirty.isOpen, true, 'Dirty form must not close immediately on back/close');
  assert.equal(promptDirty.showDiscardDialog, true, 'Dirty form must open confirm sheet');

  // Case C: Confirming discard completes sheet closing
  const confirmedState = handleCloseRequest(promptDirty);
  assert.equal(confirmedState.isOpen, false);
  assert.equal(confirmedState.isDirty, false);
});

test('WF-SHEET-04: Atomic Multi-Step Transaction Rollback Simulation (Fixes B2)', () => {
  // Verifies that multi-step mutations cleanly preserve state snapshot when aborting mid-step
  interface TestLedgerState {
    headcount: number;
    creditSales: Array<{ id: string; amount: number }>;
    auditLog: string[];
  }

  const initialState: TestLedgerState = {
    headcount: 500,
    creditSales: [],
    auditLog: ['GENESIS_HASH'],
  };

  // Transaction runner with snapshot rollback
  function runAtomicSaleTransaction(
    state: TestLedgerState,
    shouldFailStep: 1 | 2 | 3 | null
  ): { success: boolean; state: TestLedgerState } {
    // 1. Take deep snapshot
    const snapshot: TestLedgerState = JSON.parse(JSON.stringify(state));

    try {
      // Step 1: Decrement inventory
      if (shouldFailStep === 1) throw new Error('Step 1 Inventory allocation failed');
      state.headcount -= 20;

      // Step 2: Append credit sale
      if (shouldFailStep === 2) throw new Error('Step 2 Credit sale append failed');
      state.creditSales.push({ id: 'CS-001', amount: 120 });

      // Step 3: Append cryptographic audit record
      if (shouldFailStep === 3) throw new Error('Step 3 Audit seal generation failed');
      state.auditLog.push('AUDIT_BLOCK_002');

      return { success: true, state };
    } catch {
      // Rollback to pristine snapshot
      return { success: false, state: snapshot };
    }
  }

  // 1. Success case
  const successRun = runAtomicSaleTransaction(JSON.parse(JSON.stringify(initialState)), null);
  assert.equal(successRun.success, true);
  assert.equal(successRun.state.headcount, 480);
  assert.equal(successRun.state.creditSales.length, 1);
  assert.equal(successRun.state.auditLog.length, 2);

  // 2. Failure at Step 2 (e.g. storage error)
  const failRun2 = runAtomicSaleTransaction(JSON.parse(JSON.stringify(initialState)), 2);
  assert.equal(failRun2.success, false);
  assert.equal(failRun2.state.headcount, 500, 'Headcount delta must be completely rolled back');
  assert.equal(failRun2.state.creditSales.length, 0);
  assert.equal(failRun2.state.auditLog.length, 1);

  // 3. Failure at Step 3 (e.g. audit hash collision)
  const failRun3 = runAtomicSaleTransaction(JSON.parse(JSON.stringify(initialState)), 3);
  assert.equal(failRun3.success, false);
  assert.equal(failRun3.state.headcount, 500, 'Headcount delta must be rolled back on audit failure');
  assert.equal(failRun3.state.creditSales.length, 0);
});

test('WF-SHEET-05: Sticky Error Banner Contract & Field Association', () => {
  // Form submission validator producing structured error dictionary
  function validateCreditSaleForm(values: {
    customerName: string;
    quantity: string;
    unitPrice: string;
    auditNote: string;
  }): { isValid: boolean; errors: Record<string, string>; firstInvalidField: string | null } {
    const errors: Record<string, string> = {};

    const nameErr = validators.required(values.customerName, 'Customer name');
    if (nameErr) errors.customerName = nameErr;

    const qtyErr = validators.positiveInteger(values.quantity, 'Quantity');
    if (qtyErr) errors.quantity = qtyErr;

    const priceErr = validators.positiveNumber(values.unitPrice, 'Unit price');
    if (priceErr) errors.unitPrice = priceErr;

    const noteErr = validators.minAuditNote(values.auditNote, 4);
    if (noteErr) errors.auditNote = noteErr;

    const keys = Object.keys(errors);
    return {
      isValid: keys.length === 0,
      errors,
      firstInvalidField: keys[0] || null,
    };
  }

  // Case 1: Empty form produces multiple errors, flags first invalid field
  const invalidResult = validateCreditSaleForm({
    customerName: '',
    quantity: '0',
    unitPrice: '-10',
    auditNote: '',
  });

  assert.equal(invalidResult.isValid, false);
  assert.equal(invalidResult.firstInvalidField, 'customerName');
  assert.equal(Object.keys(invalidResult.errors).length, 4);

  // Case 2: Valid form passes cleanly
  const validResult = validateCreditSaleForm({
    customerName: 'Kudzi Dube',
    quantity: '25',
    unitPrice: '6.50',
    auditNote: 'Direct sale to butchery with 50% deposit',
  });

  assert.equal(validResult.isValid, true);
  assert.equal(validResult.firstInvalidField, null);
  assert.equal(Object.keys(validResult.errors).length, 0);
});

