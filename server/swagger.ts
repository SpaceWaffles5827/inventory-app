import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import express from "express";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "inventory-app",
      version: "1.0.0",
      description: "Inventory tracker app",
    },
  },
  apis: [
    "./server/app.ts",
    "./server/routes/*.ts",
    "./server/routes/users/*.ts",
    "./server/routes/users/companies/*.ts",
    "./server/routes/users/reports/*.ts",
  ],
};

const specs = swaggerJSDoc(options);

function swagger(app: express.Application) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
}

export default swagger;
