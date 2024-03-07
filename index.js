const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "goodreads.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//middleware authentication
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Get Recipes API
app.get("/recipes/", authenticateToken, async (request, response) => {
  const getRecipesQuery = `
            SELECT
              *
            FROM
             recipe`;
  const recipesArray = await db.all(getRecipesQuery);
  response.send(recipesArray);
});

//Get Recipe API
app.get("/recipes/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const getRecipeQuery = `
      SELECT
       *
      FROM
       recipe 
      WHERE
       id = ${id};
    `;
  const recipe = await db.get(getRecipeQuery);
  response.send(recipe);
});

//Post Recipe API
app.post("/recipes/", authenticateToken, async (request, response) => {
  const recipeDetails = request.body;
  const { title, description, ingredients, instructions, id } = recipeDetails;
  const addRecipeQuery = `
    INSERT INTO
    recipe (title, description, ingredients, instructions, id)
    VALUES 
    (
        '${title}',
        '${description}',
        '${ingredients}',
        '${instructions}',
        ${id}
    );`;
  const dbResponse = await db.run(addRecipeQuery);
  const recipeId = dbResponse.lastID;
  response.send({ recipeId: recipeId });
});

//Update Recipe API
app.put("/recipes/:id", authenticateToken, async (request, response) => {
  const { recipeId } = request.params;
  const recipeDetails = request.body;
  const { title, description, ingredients, instructions, id } = recipeDetails;
  const updateRecipeQuery = `
  UPDATE
  recipe
  SET
  title = '${title}',
  description = '${description}',
  ingredients = '${ingredients}',
  instructions = '${instructions}',
  id = ${id}
  WHERE
  id = ${id}`;
  await db.run(updateRecipeQuery);
  response.send("Recipe Updated Successfully");
});

//Delete Recipe API
app.delete("/recipes/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const deleteRecipeQuery = `
    DELETE FROM
      recipe
    WHERE
      id = ${id};`;
  await db.run(deleteRecipeQuery);
  response.send("Recipe Deleted Successfully");
});

//User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.get("/profile/", authenticateToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  response.send(userDetails);
});
