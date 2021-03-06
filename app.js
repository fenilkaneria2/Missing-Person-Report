var path = require('path'),
  crypto = require('crypto'),
  multer = require('multer'),
  express = require("express"),  
  mongoose = require("mongoose"),
  Grid = require('gridfs-stream'),
  date = require('date-and-time'),
  passport = require('passport'),  
  bodyParser = require("body-parser"),
  flash       = require("connect-flash"),
  LocalStrategy = require('passport-local'),
  fileExtension = require("file-extension"),
  methodOverride = require("method-override"),
  GridFsStorage = require('multer-gridfs-storage'),
  passportLocalMongoose = require('passport-local-mongoose'),
  

  app = express()

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverride('_method'));
app.use(express.static("public/uploads"));
app.use(express.static("public/img"));
app.use(flash());
let mongoURI;
if(!process.env.DATABASEURL){var config = require('./config.js');mongoURI =config.dataurl;}
else{mongoURI =process.env.DATABASEURL;}
mongoose.connect(mongoURI, { useNewUrlParser: true });

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);


//PASSPORT CONFIGURATION
app.use(require('express-session')({
  secret: "Crystal is something",
  resave: false,
  saveUninitialized: false
}));

// Init gfs
let gfs;
conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          firstname: String,
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});

const upload = multer({ storage });

var personSchema = new mongoose.Schema({
  imagepath: { type: String, default: "placeholder.png" },
  filename: String,
  files_id: String,
  firstname: String,
  lastname: String,
  address: String,
  age: Number,
  phone: String,
  location: String,
  date: Date,
  gender: String,
  username: String,
});

var Person = mongoose.model("Person", personSchema);

var UserSchema = mongoose.Schema({
  username: String,
  password: String
});
UserSchema.plugin(passportLocalMongoose);
var User = mongoose.model("User", UserSchema);

//authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});


app.get("/", function (req, res) {
  res.render("index.ejs");
  //console.log(req);
});

app.get("/person", isLoggedIn, function (req, res) {

  console.log(req.query);
  // let sort=req.query.sort;
  // let order=parseInt(req.query.order);
  // console.log(sort,order);
  let sort = {}
  sort[req.query.sort] = parseInt(req.query.order);
  console.log(sort);

  Person.find({}).sort((sort)).exec(function (err, person) {
    if (err) { console.log(err); }
    else {

      res.render("person.ejs", { person: person });
    }
  });
});

app.get("/login", function (req, res) {
  console.log(req.query.redirect); 
  let re;
  if(req.query.redirect){re= req.query.redirect.substring(8, 11);}else{re="";}
  // let  re= req.query.redirect.substring(8, 11) || "";
  console.log(re);

  res.render("login.ejs" , {re:re});
  //console.log(req);
  // { person: person }
});

app.get("/register", function (req, res) {
  res.render("register.ejs");
  //console.log(req);
});

app.get("/person/new", isLoggedIn, function (req, res) {
  res.render("new.ejs");
});

app.post('/register', function (req, res) {
  var newUser = new User({ username: req.body.username }); // Note password NOT in new User
  User.register(newUser, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      req.flash("error", err.message);
      res.redirect('/register');
    } else {
      passport.authenticate("local")(req, res, function () {
        req.flash("success", "Welcome to Missing Person Report You are Logged in " + user.username);
        res.redirect('/person');
      });
    }
  });
});

app.post('/login', passport.authenticate('local', {
  // successRedirect: "/person",
  failureRedirect: "/login",
  failureFlash: true
}), function (req, res) {

  req.flash("success", "Welcome to Missing Person Report You are Logged in "+ req.user.username );
  console.log("test +++++++++++++++++");
  // console.log(req);
  res.redirect('/person/' + req.query.redirect);
  
});

app.get('/logout', function (req, res) {
  req.logout();
  req.flash("success", "See you next time ...");
  res.redirect('/login');
});

function photoC(req, res, next) {
 console.log(req)
    return next();

}

app.post('/person', isLoggedIn, photoC, upload.single('files'), (req, res) => {

  console.log(req.file);
  console.log(req.body);
  var newPerson = {
    filename: req.file.filename,
    files_id: req.file.id,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    address: req.body.address,
    age: req.body.age,
    phone: req.body.phone,
    location: req.body.location,
    date: req.body.date,
    gender: req.body.gender,
    username: req.user.username,
  };
  Person.create(newPerson, function (err, person) {
    if (err) { console.log(err); }
    else {
      console.log("new perosn Saved");
    }
  });
  res.redirect('/person');
});

app.get('/image/:filename', isLoggedIn, (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }
    // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/gif') {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

app.get("/person/:id", isLoggedIn, function (req, res) {
  console.log(req.params.id);
  Person.findById(req.params.id, function (err, person) {
    if (err) {
      res.send(err);
    } else {
      res.render("show.ejs", { person: person });
    }
  });
});

app.put("/person/:id", isLoggedIn,checkOwner, function (req, res) {

  console.log("----req.body----");
  console.log(req.body);
  console.log("----req.params----");
  console.log(req.params);

    var newPerson = {
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      address: req.body.address,
      age: req.body.age,
      phone: req.body.phone,
      location: req.body.location,
      date: req.body.date,
      gender: req.body.gender,
      username: req.user.username
    };

    Person.findByIdAndUpdate(req.params.id, newPerson, function (err, person) {
      if (err) {
        res.redirect("/");
      } else {

        res.redirect("/person/" + req.params.id);
      }
    });
  });

app.get("/person/:id/edit", isLoggedIn,checkOwner, function (req, res) {
  console.log(req.params.id);
  Person.findById(req.params.id, function (err, person) {
    if (err) {
      res.send(err);
    } else {
      res.render("edit.ejs", { person: person, date: date });
    }
  });
});

app.delete('/person/:id', isLoggedIn,checkOwnerdel ,(req, res) => {

    //working
    gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
      if (err) {
        return res.status(404).json({ err: err });
      }
      console.log(req.params.id);
      Person.findOneAndDelete({ files_id: req.params.id }, function (err, res1) {
        if (!err) {
          req.flash("success", "people deleted");
          console.log("people deleted");
        }
        else {
          console.log("people error");
        }
        res.redirect('/person');
      });
    });
  });

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "You must log in to do this ...");
  console.log(req.url);
  res.redirect("/login?redirect=" + req.url);
}

function checkOwnerdel(req, res, next) {
  console.log(req.params.id);
  Person.findOne({ files_id: req.params.id }, function (err, person) {
    if (err) {
      res.send(err);
    } else {
      console.log(req.user.username,person.username);
      if (!(req.user.username == person.username) && req.user.username!="admin") {
        req.flash("error", "Sorry, you are not created this person");
        res.redirect("/person/" + person._id);    
       
      }else{ return next();}
    }
  });
}
function checkOwner(req, res, next) {
  Person.findById(req.params.id, function (err, person) {
    console.log(req.params.id);
    if (err) {
      res.send(err);
    } else {
      console.log(req.user.username,person.username);
      if (!(req.user.username == person.username) && req.user.username!="admin") {
        req.flash("error", "Sorry, you are not created this person");
        res.redirect("/person/" + req.params.id);      
       
      }else{ return next();}
    }
  });
}

app.listen(process.env.PORT, process.env.IP, () => { console.log("started"); });
// var port = 3005;
// app.listen(port, () => console.log(`Example app listening on port ${port}!`))