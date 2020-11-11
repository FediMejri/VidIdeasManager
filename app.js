const express=require('express')
const exphbs  = require('express-handlebars');
const Handlebars = require('handlebars')
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const bcryptn = require('bcrypt')
const passport = require('passport')
const flash = require('connect-flash')
const session = require('express-session')
require('./models/Idea')
require('./models/User')
const {ensureAuthentication} = require('./Auth/auth')

const port=process.env.port || 5000 

const app=express()

//connect to mongoose 
mongoose.Promise=global.Promise
mongoose.connect('mongodb+srv://mohamedfedi:abcdefg1234!@cluster0-5q2tv.mongodb.net/VidIdeas?retryWrites=true&w=majority',{
    useUnifiedTopology:true})
    .then(console.log('database connected'))
    .catch(err=>{
        console.log(err)
    })

const Idea=mongoose.model('ideas')
const User=mongoose.model('users')

//Passport config
require('./config/passport')(passport)

//Handlebars middleware
app.engine('handlebars', exphbs({
    handlebars: allowInsecurePrototypeAccess(Handlebars)
}));
app.set('view engine', 'handlebars');

//BodyParser middleware
app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json())

// Express session midleware
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
  }));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use(function(req,res,next){
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user=req.user || null 
    next()
})

//Routing
app.get('/',(req,res)=>{
    res.render('home')
})
app.get('/about',(req,res)=>{
    res.render('about')
})
app.get('/ideas',ensureAuthentication,(req,res)=>{
    Idea.find({user:req.user.id})
    .sort({date:'desc'})
    .then(ideas=>{
        res.render('ideas/index',{
            ideas:ideas
        })
    })
})

//Add Idea Form
app.get('/ideas/add',ensureAuthentication,(req,res)=>{
    res.render('ideas/add')
})

//Edit Idea Form
    app.get('/ideas/edit/:id',ensureAuthentication,(req,res)=>{
        const id=req.params.id
        Idea.findOne({_id:id})
        .then(idea=>{
            if(idea.user !=req.user.id){
                req.flash('error_msg','Not Authorized')
                res.redirect('/ideas')
            }else{
                res.render('ideas/edit',{
                    idea : idea
                })
            }
        })
    })

//Delete an Idea 
    app.get('/ideas/delete/:id',ensureAuthentication,(req,res)=>{
        const id = req.params.id
        Idea.remove({_id : id}).exec().then(
            Idea.find()
            .sort({date:'desc'})
            .then(ideas=>{
                res.render('ideas/index',{
                    ideas:ideas
                })
            })
            )
        .catch(err=>{
            res.json({error : err})
        })
    })

//Process form
app.post('/ideas',ensureAuthentication,(req,res)=>{
    let errors=[]
    if(!req.body.title){
        errors.push({text:'Please add a title'})
    }
    if(!req.body.details){
        errors.push({text:'Please add some details'})
    }
    if(errors.length>0){
        res.render('ideas/add',{
            errors : errors,
            title : req.body.title,
            details : req.body.details
        })
    }else{
        const newIdea = {
            title : req.body.title,
            details : req.body.details,
            user: req.user.id
        }
        new Idea(newIdea).save()
        .then(idea=>{
            res.redirect('/ideas')
        })
        .catch(err=>{
            res.json({error : err})
        })
    }
})

// User Login
app.get('/users/login',(req,res)=>{
    res.render('users/login')
})

//User Registration
app.get('/users/register',(req,res)=>{
    res.render('users/register')
})

//Register form post
app.post('/users/register',(req,res)=>{
    let errors=[]
    if(req.body.password!=req.body.password2){
        errors.push({text:'Passwords do not match'})
    }
    if(req.body.password.length<4){
        errors.push({text : 'Password must contain at least 4 characters'})
    }
    if(errors.length>0){
        res.render('users/register',{
            errors : errors,
            name : req.body.name,
            email : req.body.email,
        })
    }else{
        User.findOne({email:req.body.email}).then(user=>{
            if(user){
                errors.push({text:'User already exists, Go to the login page'})
                res.render('users/register',{
                    errors : errors
                })
            }else{
                const newUser={
                    name : req.body.name,
                    email : req.body.email,
                    password : req.body.password
                }
                bcrypt.genSalt(10,(err, salt)=>{
                    bcrypt.hash(newUser.password,salt,(err, hash)=>{
                        if(err){throw err}
                        newUser.password = hash
                        new User(newUser).save()
                        .then(res.redirect('/users/login'))
                        .catch(err=>{
                            res.json({error : err})
                        })
                    })
                })
            }
        })
        
    }
})

//Login form post
app.post('/users/login',(req,res,next)=>{
    passport.authenticate('local',{
        successRedirect:'/ideas',
        failureRedirect:'/users/login',
        failureFlash:true
    })(req,res,next)
})

//Logout 
app.get('/users/logout',(req,res)=>{
    req.logout()
    req.flash('success_msg', 'You are logged out')
    res.redirect('/users/login')
})

app.listen(port,()=>{
    console.log('Server started on port '+port)
})