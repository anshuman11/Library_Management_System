// MODULES REQUIRED FOR PROJECT
const express       = require('express');
const mongoose      = require('mongoose');
const app           = express();
const session       = require('express-session');
const bodyParser    = require('body-parser');
const passport      = require('passport');
const passportLocal = require('passport-local').Strategy;
const cookieParser  = require('cookie-parser');
const bcrypt        = require('bcryptjs');
const saltrounds    = 10;
const path          = require('path');
require('dotenv').config();

// MIDDLEWARES

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: "ItIsSecret",
    saveUninitialized: true,
    resave: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));


// URL OF MONGODB ATLAS

const url = 'mongodb+srv://dev_chauhan_10:mypassword123@myproject-be1gc.mongodb.net/test?retryWrites=true&w=majority';

mongoose.Promise = global.Promise;

// CONNECT MONGOOSE TO MONGODB ATLAS

mongoose.connect(url, {
    useNewUrlParser: true
});
var db = mongoose.connection;
db.on('error', function (err) {
    throw err;
});

// DEFINE SCHEMA FOR BOOK

var bookSchema = new mongoose.Schema({
    category: {
        type: String,
        required: [true, "Please! provide **Category** of this book to add into database ?"]
    },
    edition: {
        type: Number,
        required: [true, "Please! provide **Edition of Book** to add this book into database ?"]
    },
    bookName: {
        type: String,
        required: [true, "Please! provide **BookName** to add this book into database ?"]
    },
    autherName: {
        type: String,
        required: [true, "Please! provide **AutherName** to add this book into database ?"]
    },
    currentAvailable: {
        type: String,
        required: [true, "Please! provide **Current Availability** to add this book into database ?"]
    },
    bookImage: String,
    dueDate: Date,
    issueDate: Date
});

// MAKE BOOK MODEL BASED ON BOOK SCHEMA

var bookModel = mongoose.model('book', bookSchema);

// DEFINE STUDENT SCHEMA

var studentSchema = new mongoose.Schema({
    studentName: String,
    username: String,
    password: String,
    data: Array
});

// CREATE STUDENT MODEL BASED ON STUDENT SCHEMA

var studentModel = mongoose.model('student', studentSchema);


//   REST APIs


// HOMEPAGE

app.get('/', function (req, res) {
    res.render("home");
});




// SIGNUP API FOR USER TO REGISTER ON WEBSITE

app.post('/signup', function (req, res) {
    if (req.body.username) {
        studentModel.findOne({
                username: req.body.username
            })
            .exec()
            .then((doc) => {
                if (doc) {
                    res.send("Sorry!!..This **userId** is already taken..Try some other");
                } else {
                    if (req.body.password) {
                        bcrypt.hash(req.body.password, saltrounds, function (err, hash) {
                            if (err) {
                                res.send("Some error occurred!!..Student not registered");
                            } else {
                                var student = new studentModel({
                                    studentName: req.body.studentName,
                                    username: req.body.username,
                                    password: hash
                                });
                                student.save(function (err) {
                                    if (err) {
                                        res.send("Some error occurred!!..Student not saved");
                                    } else {
                                        res.redirect(307,'/viewBooks');
                                    }
                                });
                            }
                        });
                    } else {
                        res.send("Warning!!..You must provide **password** to register");
                    }
                }
            })
            .catch((err) => {
                res.send("Some error occurred !!.....Please try again after sometime");
            });
    } else {
        res.send("Warning!!..UserId cannot be empty");
    }

});


// LOGIN API FOR REGISTERED USERS


app.post('/login', 
    passport.authenticate('local', { failureRedirect: '/login' }),
    function(req, res) {
    res.redirect(307,'/viewBooks');
    });

// USE LOCAL STRATEGY FOR AUTHENTICATION OF USERS

passport.use(new passportLocal(
    function (username, password, done) {
        studentModel.findOne({
            username: username
        }, function (err, doc) {
            if (err)
                throw err;
            if (!doc) {
                return done(null, false);
            } else {
                passw = doc.password;
                bcrypt.compare(password, passw, function (err, res) {
                    if (res) return done(null, username);
                    else return done(null, false);
                });
            }
        });
    }));

// SERIALIZE AND DESERIALIZE USER TO MAINTAIN A SESSION FOR THE USER

passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (user, done) {
    done(null, user);
});


// API TO ISSUE BOOK FOR REGISTERED USER

app.post('/reserveBook', async function(req,res){
    if (req.body.bookId == null) {
        res.send("Sorry!! Booking process cannot be initialized without **book_id** ");
    } else {
        var targetBook = await bookModel.findById(req.body.bookId)
            .exec()
            .then((doc) => {
                return doc;
            })
            .catch((err) => {
                res.send("Some error occurred !!.....Please check your **book_id** again");
            });
        if (targetBook.currentAvailable.toLowerCase() != "true") {
            res.send("Sorry!!! This book is not currently available");
        } else {
                // ADD ISSUED BOOK TO USER'S ACCOUNT
                var date = new Date();
                date.setDate(date.getDate() + 15);
            var reservedBook = await bookModel.findByIdAndUpdate({_id: req.body.bookId },
                    {   $set : { currentAvailable : false , dueDate : date, issueDate : new Date()}
                        //$currentDate: { issueDate : { $type: "date" } }
                    },
                    { new : true }
                    )
                    .exec()
                    .then((doc) => {
                        return doc;
                    })
                    .catch((err) => {
                        res.send("Some error occurred !!.....Can't find Updated document");
                    });
                
            // UPDATE AVAILABILITY STATUS OF ISSUED BOOK IN THE SYSTEM
                                    studentModel.where({
                                        username: req.user
                                    })
                                                .updateOne({
                                                    $push: { data: reservedBook } 
                                                })
                                                .then(() => {
                                                    res.json({
                                                    "status": "ok",
                                                    "result": "The Book Reserved for you!"
                                                    });
                                                    })
                                                .catch((err) => {
                                                res.send("Some error occurred !!...Please try after sometime");
                                            });
                                    // });
                        
        }
    }
});



// API TO SHOW PROFILE OF PARTICULAR STUDENT

app.post('/showMyHistory', async function (req, res) {
    if( !req.user ){
        res.send("You are not Logged in");
    }
    else{
                

                var myUser = await studentModel.findOne({ username: req.user })
                .exec()
                .then((doc) => {
                    return doc;
                })
                .catch((err) => {
                    res.send("Some error occurred !!.....Please check your **User Id** again");
                });



                var userHistory = myUser.data.map( function (book) {

                var tempdata = {
                                "bookName": book.bookName,
                                "autherName": book.autherName,
                                "category": book.category,
                                "currentAvailable": book.currentAvailable,
                                "edition": book.edition,
                                "bookImage": book.bookImage,
                                "issueDate": book.issueDate,
                                "dueDate": book.dueDate
                                };
                            return tempdata;
                            });
                if (userHistory == null)
                res.send("No history here..!!");
                else
                res.render('profile', { userHistory: userHistory });
        }
    
});






// API TO ADD THE BOOKS IN THE SYSTEM ( SHOULD BE ONLY FOR ADMIN )


app.post('/admin/addBook', function (req, res) {
    var book = new bookModel(req.body);
    book.save(function (err) {
        if (err) {
            var errorResponse;
            if (err.errors.bookName != undefined)
                errorResponse = err.errors.bookName.properties;
            else if (err.errors.autherName != undefined)
                errorResponse = err.errors.autherName.properties;
            else if (err.errors.category != undefined)
                errorResponse = err.errors.category.properties;
            else if (err.errors.edition != undefined)
                errorResponse = err.errors.edition.properties;
            else if (err.errors.currentAvailable != undefined)
                errorResponse = err.errors.currentAvailable.properties;
            res.json(errorResponse);
        } else
                res.render('admin');
    });

});

// API TO VIEWBOOKS FOR ADMIN

app.post('/admin/viewBooks', async function (req, res) {
    var allBooks = await new Promise(function (resolve, reject) {
        var temp = bookModel.find({});
        resolve(temp);
    });
    if (req.body.bookName) {
        allBooks = allBooks.filter(function (book) {
            if (req.body.bookName.toUpperCase() == book.bookName.toUpperCase()) {
                return book;
            }
        });
    }

    if (req.body.autherName) {
        allBooks = allBooks.filter(function (book) {
            if (req.body.autherName.toUpperCase() == book.autherName.toUpperCase()) {
                return book;
            }
        });
    }

    if (req.body.category) {
        allBooks = allBooks.filter(function (book) {
            if (req.body.category.toUpperCase() == book.category.toUpperCase()) {
                return book;
            }
        });
    }


    

    allFilteredBooks = allBooks.map(function (book) {
        var filteredBook = {
            "bookId": book._id,
            "bookName": book.bookName,
            "autherName": book.autherName,
            "category": book.category,
            "currentAvailable": book.currentAvailable,
            "edition": book.edition,
            "bookImage": book.bookImage
        };
        return filteredBook;
    });
    if (allFilteredBooks == null)
        res.send("No such Book exists for these filters..!!");
    else
        res.render("allBooksAdmin", { allFilteredBooks: allFilteredBooks });
});


// API TO DELETE THE BOOKS FROM THE SYSTEM ( SHOULD BE ONLY FOR ADMIN )


app.post('/admin/deleteBook', async function (req, res) {
        bookModel.deleteOne({
            _id: req.body._id
        })
        .exec()
        .then(() => {
            res.render('admin');
        })
        .catch((err) => {
            res.json({
                "status": "Bad!",
                "result": "Some error occurred! Book is not deleted from database"
            });
        });
    
});


// API TO UPDATE THE BOOK IN THE SYSTEM ( SHOULD BE ONLY FOR ADMIN )


app.post('/admin/update', async function (req, res) {
    
        bookModel.updateOne({
            _id: req.body._id
        }, req.body)
        .exec()
        .then(() => {
            res.render('admin');
        })
        .catch((err) => {
            res.send("Some error occurred!..Book is not updated");
        });   
    


});

// API TO SHOW RECORD OF ALL STUDENTS

app.post('/admin/allStudents', async function(req, res){
    var allStudents = await new Promise(function (resolve, reject) {
        var temp = studentModel.find({});
        resolve(temp);
    });
    if (req.body.username) {
        allStudents = allStudents.filter(function (student) {
            if (req.body.username.toUpperCase() == student.username.toUpperCase()) {
                return student;
            }
        });
    }

    if (req.body.studentName) {
        allStudents = allStudents.filter(function (student) {
            if (req.body.studentName.toUpperCase() == student.studentName.toUpperCase()) {
                return student;
            }
        });
    }

    allFilteredStudents = allStudents.map(function (student) {
        var filteredStudent = {
            "studentId": student.username,
            "studentName": student.studentName
        };
        return filteredStudent;
    });
    if (allFilteredStudents == null)
        res.send("No such Student exists for these filters..!!");
    else
        res.render("allStudents", { allFilteredStudents: allFilteredStudents });

});

// API TO VIEW THE ALL BOOKS WITH USING FILTERS BASED ON BOOK PROPERTIES FOR ANY STUDENT


app.post('/viewBooks', async function (req, res) {
    var allBooks = await new Promise(function (resolve, reject) {
        var temp = bookModel.find({});
        resolve(temp);
    });
    if (req.body.bookName) {
        allBooks = allBooks.filter(function (book) {
            if (req.body.bookName.toUpperCase() == book.bookName.toUpperCase()) {
                return book;
            }
        });
    }

    if (req.body.autherName) {
        allBooks = allBooks.filter(function (book) {
            if (req.body.autherName.toUpperCase() == book.autherName.toUpperCase()) {
                return book;
            }
        });
    }

    if (req.body.category) {
        allBooks = allBooks.filter(function (book) {
            if (req.body.category.toUpperCase() == book.category.toUpperCase()) {
                return book;
            }
        });
    }


    

    allFilteredBooks = allBooks.map(function (book) {
        var filteredBook = {
            "bookId": book._id,
            "bookName": book.bookName,
            "autherName": book.autherName,
            "category": book.category,
            "currentAvailable": book.currentAvailable,
            "edition": book.edition,
            "bookImage": book.bookImage
        };
        return filteredBook;
    });
    if (allFilteredBooks == null)
        res.send("No such Book exists for these filters..!!");
    else
        res.render("allBooks", { allFilteredBooks: allFilteredBooks });
});







// ALL STUDENTS RECORDS


app.post('/admin/showMyHistory', async function (req, res) {
                var myUser = await studentModel.findOne({ username: req.body.username })
                .exec()
                .then((doc) => {
                    return doc;
                })
                .catch((err) => {
                    res.send("Some error occurred !!.....Please check your **User Id** again");
                });
                var userHistory = myUser.data.map(function (book) {
                var tempdata = {
                                "bookName": book.bookName,
                                "autherName": book.autherName,
                                "category": book.category,
                                "currentAvailable": book.currentAvailable,
                                "edition": book.edition,
                                "bookImage": book.bookImage,
                                "issueDate": book.issueDate,
                                "dueDate": book.dueDate
                                };
                            return tempdata;
                            });
                            //console.log("USER HISTORY : "+ JSON.stringify(userHistory));
                if (userHistory == null)
                res.send("No history here..!!");
                else
                res.render('profile', { userHistory: userHistory });
    
});



// ADMIN PAGE

app.get('/admin',function(req, res){
    res.render("adminCheck");
});

app.post('/admin',function(req, res){
    if(req.body.adminId === 'iiituna'){
        if(req.body.password === 'iiitu123'){
            res.render('admin');
        }
        else{
            res.send("You entered wrong password!!!");
        }
    }
    else{
        res.send("Please! check your Admin Id again");
    }
});

app.set('port', process.env.PORT || 5000);

app.listen(app.get('port'), function (err) {
    if (err)
        console.log(err);
    console.log('Running on http://localhost:%s', app.get('port'));
});