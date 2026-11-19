// A module function that reads the clock itself cannot be tested at a fixed
// moment. Take the time as an argument (CODING_STANDARDS.md, "Inject the
// clock"), and let the route pass `new Date()`.

const isDateNow = (callee) =>
  callee.type === "MemberExpression" &&
  !callee.computed &&
  callee.object.type === "Identifier" &&
  callee.object.name === "Date" &&
  callee.property.name === "now";

const noClockRead = {
  meta: {
    type: "problem",
    messages: {
      read: "This reads the clock. Take the time as a `now: Date` argument instead (Inject the clock).",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isDateNow(node.callee)) context.report({ node, messageId: "read" });
      },
      NewExpression(node) {
        const isDate =
          node.callee.type === "Identifier" && node.callee.name === "Date";
        if (isDate && node.arguments.length === 0) {
          context.report({ node, messageId: "read" });
        }
      },
    };
  },
};

export default {
  meta: { name: "clock" },
  rules: { "no-read": noClockRead },
};
