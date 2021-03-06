//@ts-check
const express = require('express'),
morgan = require('morgan'),
bodyParser = require('body-parser'),
uuid = require("uuid");
const mongoose = require('mongoose');
const Models = require('./models.js');
const Movies = Models.Movie;
const Users = Models.User;
const cors = require('cors');
const { check, validationResult } = require('express-validator');    
const app = express();

mongoose.connect('mongodb+srv://rutinsped:1Rutinsped5@cinesider-uci2n.mongodb.net/Movies?retryWrites=true&w=majority', { useNewUrlParser: true });

app.use(morgan("common"));

app.use(bodyParser.json());

app.use(cors());

var allowedOrigins = ['http://cinesider.herokuapp.com/', 'https://cinesider.herokuapp.com/', 'http://localhost:3000', 'http://localhost:1234', 'http://localhost:27017']

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){ // If a specific origin isn’t found on the list of allowed origins
      var message = 'The CORS policy for this application doesn’t allow access from origin ' + origin;
      return callback(new Error(message ), false);
    }
    return callback(null, true);
  }
}));

var auth = require('./auth')(app);

const passport = require('passport');
require('./passport');

app.use(express.static('public', {
  etag: true, // Just being explicit about the default.
  lastModified: true,  // Just being explicit about the default.
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // All of the project's HTML files end in .html
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));


// Get movies and details

app.get('/movies', passport.authenticate('jwt', { session: false }), function(req, res) {

  Movies.find()
  .then(function(movies) {
    res.status(201).json(movies)
  })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});

app.get('/movies/:Title', passport.authenticate('jwt', { session: false }), function(req, res) {
  Movies.findOne({ Title : req.params.Title })
  .then(function(movie) {
    res.json(movie)
  })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});

app.get('/movies/genres/:Name', passport.authenticate('jwt', { session: false }), function(req, res) {
  Movies.findOne({'Genre.Name': req.params.Name})
  .then(function(movie){
    res.json(movie)
    })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error:" + err);
  });
});

app.get('/movies/genres/:Title', passport.authenticate('jwt', { session: false }), function(req, res) {
  Movies.findOne({'Genre.Title': req.params.Title})
  .then(function(movie){
    if(movie){
      res.status(201).send("Movie with the title : " + movie.Title + " is  a " + movie.Genre.Name + " ." );
    }else{
      res.status(404).send("Movie with the title : " + req.params.Title + " was not found.");
        }
    })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error:" + err);
  });
});

app.get('/movies/directors/:Name', passport.authenticate('jwt', { session: false }), function(req, res) {
  Movies.findOne({"Director.Name" : req.params.Name})
  .then(function(movies){
    res.json(movies.Director)
  })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error:" + err);
  });
});

// Post, Put, Delete - Create, Update, Delete with Movies

app.post("/movies", passport.authenticate('jwt', { session: false }), (req, res, next) => {
  let newmovie = req.body;

  if (!newmovie.title) {
    const message = "Missing title in request body";
    res.status(400).send(message);

  } else {
    newmovie.id = uuid.v4();
    Movies.push(newmovie);
    res.status(201).send(newmovie);
  }
});

// Post, Put, Delete - Create, Update, Delete with Users

app.get('/users', passport.authenticate('jwt', { session: false }), function(req, res) {

  Users.find()
  .then(function(users) {
    res.status(201).json(users)
  })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});

app.get('/users/:Username', passport.authenticate('jwt', { session: false }),function(req, res) {
  Users.findOne({ Username : req.params.Username })
  .then(function(user) {
    res.json(user)
  })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});

app.post('/users',
[ check('Username', 'Username is required').isLength({min: 5}),
  check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
  check('Password', 'Password is required').not().isEmpty(),
  check('Email', 'Email does not appear to be valid').isEmail() ],
  (req, res) => {

  var errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

  var hashedPassword = Users.hashPassword(req.body.Password);
  Users.findOne({ Username : req.body.Username })
  .then(function(user) {
    if (user) {
      return res.status(400).send(req.body.Username + "already exists");
    } else {
      Users
      .create({
        Username: req.body.Username,
        Name: req.body.Name,
        Password: hashedPassword,
        Email: req.body.Email,
      })
      .then(function(user) {res.status(201).json(user)
      })
      .catch(function(error) {
        console.error(error);
        res.status(500).send("Error: " + error);
      })
    }
  }).catch(function(error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  });
});

app.put('/users/:Username', passport.authenticate('jwt', { session: false }), function(req, res) {
  Users.findOneAndUpdate({ Username : req.params.Username }, 
  { $set :
    {
    Username : req.body.Username,
    Name : req.body.Name,
    Password : req.body.Password,
    Email : req.body.Email,
    Birth_date : req.body.Birth_date
        }},

  { new : true },

  function(err, updatedUser) {
    if(err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    } else {
      res.json(updatedUser)
    }
  })
});

app.post('/users/:Username/Movies/:MovieID', passport.authenticate('jwt', { session: false }), function(req, res) {
  Users.findOneAndUpdate({ Username : req.params.Username }, {
    $push : { Favorit_movie : req.params.MovieID }
  },
  { new : true }, // This line makes sure that the updated document is returned
  function(err, updatedUser) {
    if (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    } else {
      res.json(updatedUser)
    }
  })
});

app.delete('/users/:Username/Movies/:MovieID', passport.authenticate('jwt', { session: false }), function(req, res) {
  Users.findOneAndUpdate({ Username : req.params.Username }, {
    $pull : { Favorit_movie : req.params.MovieID }
  },
  { new : true }, // This line makes sure that the updated document is returned
  function(err, updatedUser) {
    if (err) {
      console.error(err);
      res.status(500).send("Error: " + err);
    } else {
      res.json(updatedUser)
    }
  })
});

app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), function(req, res) {
  Users.findOneAndRemove({ Username: req.params.Username })
  .then(function(user) {
    if (!user) {
      res.status(400).send(req.params.Username + " was not found");
    } else {
      res.status(200).send(req.params.Username + " was deleted.");
    }
  })
  .catch(function(err) {
    console.error(err);
    res.status(500).send("Error: " + err);
  });
});

app.get('/', function(req, res) {
  res.send('Welcome to the Cinesider');
});

var port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", function() {
console.log("Listening on Port 3000");
});

console.log("It's working!");