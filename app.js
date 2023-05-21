const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const format = require("date-fns/format");
const isMatch = require("date-fns/isMatch");
var isValid = require("date-fns/isValid");
const app = express();
app.use(express.json());

let database;
const initializeDBandServer = async () => {
  try {
    database = await open({
      filename: path.join(__dirname, "todoApplication.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DataBase error is ${error.message}`);
    process.exit(1);
  }
};
initializeDBandServer();

//authentication
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.header["authorization"];
  if (authHeader) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken) {
    jwt.verify(jwtToken, "SECRET_KEY", (error, payload) => {
      if (error) {
        response.status(481);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  } else {
    response.status(481);
    response.send("Invalid JWT Token");
  }
};

//tweetAccessVerification
const tweetAccessVerification = async (request, response, next) => {
  const { userId } = request;
  const { tweetId } = request.params;
  const getTweetQuery = `SELECT *
            FROM tweet INNER JOIN follower
            ON tweet.user_id = follower. following_user_id
            WHERE tweet.tweet_id = '${tweetId}' AND follower_user_id = '${userId}';`;

  const tweet = await db.get(getTweetQuery);
  if ((tweet = undefined)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};

//Api 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}";`;
  const userDBDetails = await db.get(getUserQuery);
  if (userDBDetails === undefined) {
    response.status(488);
    response.send("User already exists");
  } else {
    if (password.Length < 6) {
      response.status(488);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `INSERT INTO user (username, password, name, gender)
             VALUES('${username}', '${hashedPassword}', '${name}', '${gender}')`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// Api 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username='${username}'; `;
  const userDbDetails = await db.get(getUserQuery);
  if (userDbDetails === undefined) {
    const isPasswordCorrect = await bcrypt.compare(
      password,
      userDbDetails.password
    );
    if (isPasswordCorrect) {
      const payload = { username, userId: userDbDetails.user_id };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(488);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// Api 3
app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request;
  const followingPeopleIds = await getFollowingPeopleIdsOfUser(username);
  const getTweetsQuery = `SELECT
    username, tweet, date time as dateTime
    FROM user INNER JOIN tweet ON user.user_id = tweet.user_id WHERE
    user.user_id IN ($(followingPeopleIds} )
    ORDER BY date time DESC
    LIMIT 4;`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//Api 4
app.get("/user/following/", authentication, async (request, response) => {
  const { username, userId } = request;
  const getFollowingUsersQuery = `SELECT name FROM follower INNER JOIN User ON user.user_id = follower. following_user_id WHERE follower_user_id= '${userId}';`;
  const followingPeople = await db.all(getFollowingUsersQuery);
  response.send(followingPeople);
});
// API - 5
app.get("/user/followers/", authentication, async (request, response) => {
  const { username, userId } = request;
  const getFollowersQuery = `SELECT DISTINCT name FROM follower
    INNER JOIN user ON user.user_id follower, follower_user_id WHERE following user_id='${userId}';`;
  const followers = await db.all(getFollowersQuery);
  response.send(followers);
});

//Api 6
app.get(
  "/tweets/:tweet Id/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { username, userId } = request;
    const { tweetId } = request.params;
    const getTweetQuery = `SELECT tweet, (SELECT COUNT() FROM Like WHERE tweet_id = '${tweetId}') AS likes,
    (SELECT COUNT() FROM reply WHERE tweet id='${tweetId}') AS replies,
    date_time AS dateTime
    FROM tweet
    WHERE tweet, tweet_id = '${tweetId}';`;
    const tweet = await db.get(getTweetQuery);
    response.send(tweet);
  }
);

// Api 7
app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { tweetId } = request.params;
    const getLikesQuery = `
    SELECT username 
    FROM user 
    INNER JOIN like ON user.user_id = like.user_id
    WHERE tweet_id = '${tweetId}';`;
    const LikedUsers = await db.all(getLikesQuery);
    const usersArray = likedUsers.map((eachUser) => eachUser.username);
    response.send({ likes: usersArray });
  }
);

// API - 8
app.get(
  "/tweets/: tweet Id/replies/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { tweetId } = request.params;
    const getRepliedQuery = `SELECT name, reply
    FROM user INNER JOIN reply ON user.user_id = reply.user_id WHERE tweet_id = '${tweetId}';`;
    const repliedUsers = await db.all(getRepliedQuery);
    response.send({ replies: repliedUsers });
  }
);

// Api 9
app.get("/user/tweets/", authentication, async (request, response) => {
  const { userId } = request;
  const getTweetsQuery = `SELECT tweet,
    COUNT (DISTINCT Like_id) AS likes,
    COUNT (DISTINCT reply_id) AS replies, date time AS dateTime
    FROM tweet LEFT JOIN reply ON tweet. tweet_id = reply.tweet_id
    LEFT JOIN like ON tweet. tweet_id = like.tweet_id WHERE tweet.user_id = ${userId}
    GROUP BY tweet.tweet_id;`;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

// API - 10
app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const userId = parseInt(request.userId);
  const dateTime = new Date().toJSON().substring(0, 19).replace("T", "");
  const createTweetQuery = `INSERT INTO tweet (tweet, user_id, date_time)
    VALUES (${tweet}', '${userId}', '${dateTime}')`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

// Api 11
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const tweetId = request.params;
  const { userId } = request;
  const getTheTweetQuery = `SELECT * FROM tweet WHERE user_id='${userId} AND tweet_id = '${tweetId}';`;
  const tweet = await db.get(getTheTweetQuery);
  console.log(tweet);
  if (tweet === undefined) {
    response.status(481);
    response.send("Invalid Request");
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = '${tweetId}';`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
});

module.exports = app;
