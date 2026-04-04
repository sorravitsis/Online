const tests = [
  {
    name: "auth token lifecycle",
    run: require("./auth.test.cjs").run
  },
  {
    name: "print workflow",
    run: require("./print-workflow.test.cjs").run
  },
  {
    name: "order filters",
    run: require("./order-filters.test.cjs").run
  },
  {
    name: "scan helpers",
    run: require("./scan.test.cjs").run
  },
  {
    name: "shopee adapter helpers",
    run: require("./shopee-adapter.test.cjs").run
  },
  {
    name: "batch helpers",
    run: require("./batch.test.cjs").run
  },
  {
    name: "admin helpers",
    run: require("./admin.test.cjs").run
  },
  {
    name: "hardening helpers",
    run: require("./hardening.test.cjs").run
  }
];

(async () => {
  let passed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS ${test.name}`);
    } catch (error) {
      console.error(`FAIL ${test.name}`);
      console.error(error);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`PASS ${passed}/${tests.length} tests`);
})().catch((error) => {
  console.error("FAIL unexpected test harness error");
  console.error(error);
  process.exitCode = 1;
});
