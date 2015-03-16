var router = getRouter();
var User = require('./model');
var Message = require('../../helpers/mailer');

/**
* Create a new user
* POST /users
*/
router.post('/users', function (req, res) {
  var errors = User.validate(req.body);
  if (errors.length) return res.multiError(errors);

  var salt = User.Helpers.salt();
  var token = User.Helpers.token();

  var user = new User({
    email: req.body.email,
    password: User.Helpers.hash(req.body.password, salt),
    salt: salt,
    token: token,
    created: Date.now()
  });

  user.save(function (err, user) {
    if (err) return res.singleError('That email is already in use');

    if (process.env.NODE_ENV == 'production') {
      sendRegistrationEmail(user.email);
    }

    return res.json({
      key: user._id,
      token: user.token
    });
  });
});

/**
* Get a key and token
* POST /users/token
*/
router.post('/users/token', function (req, res) {
  User
    .findOne()
    .where({email: req.body.email})
    .exec(function (err, user) {
      if (err || !user) return res.singleError('Email or password incorrect');

      if (User.Helpers.checkPassword(user.password, req.body.password, user.salt)) {
        if (user.token) {
          return res.json({
            key: user._id,
            token: user.token
          });
        } else {
          var token = User.Helpers.token();

          user.save(function (err, user) {
            User.Helpers.cache(user);
            return res.json({
              key: user._id,
              token: user.token
            });
          });
        }
      } else {
        return res.singleError('Email or password incorrect');
      }
    });
});

/**
* Delete a token
* DELETE /users/token
* Auth
*/
router.delete('/users/token', User.auth(), function (req, res) {
  User
    .findById(req.user._id)
    .exec(function (err, user) {
      if (err || !user) return res.internalError();
      user.token = null;
      user.save(function (err, user) {
        if (err) return res.internalError();
        User.Helpers.uncache(user, function () {
          return res.json({});
        });
      });
    });
});

/**
* Get a list of all users
* GET /users
* Auth -> admin, staff
*/
router.get('/users', User.auth('admin', 'staff'), function (req, res) {
  User
    .find()
    .exec(function (err, users) {
      if (err) return res.internalError();
      return res.json({
        users: users
      });
    });
});

/**
* Get a user by ID
* GET /users/:id
* Auth -> admin, staff
*/
router.get('/users/:id', User.auth('admin', 'staff'), function (req, res) {
  User
    .findById(req.params.id)
    .select('email role created')
    .exec(function (err, user) {
      if (err) return res.internalError();
      return res.json(user);
    });
});

/**
* Update the logged in user
* PUT /users
* Auth
*/
router.put('/users', User.auth(), function (req, res) {
  User
    .findById(req.user._id)
    .exec(function (err, user) {
      if (err) return res.internalError();
      if (req.body.email) {
        user.email = req.body.email;
      }
      if (req.body.password) {
        user.salt = User.Helpers.salt();
        user.password = User.Helpers.hash(req.body.password, salt);
      }
      user.save(function (err, user) {
        if (err) return res.singleError('That email is already taken');
        return res.json({
          email: user.email
        });
      });
    });
});

/**
* Update a user by ID
* PUT /users/:id
* Auth -> admin
*/
router.post('/users/:id', User.auth('admin'), function (req, res) {
  User
    .findById(req.params.id)
    .update(req.body)
    .exec(function (err, user) {
      if (err) return res.internalError();
      return res.json(user);
    });
});

/**
* Delete a user
* DELETE /users/:id
* Auth -> admin
*/
router.delete('/users/:id', User.auth('admin'), function (req, res) {
  User
    .findById(req.params.id)
    .remove()
    .exec(function (err) {
      if (err) return res.internalError();
      return res.json(user);
    });
});

/**
* Helper method to send a registration email
*/
function sendRegistrationEmail(email) {
  var message = new Message({
    template: 'registration',
    subject: 'Kent Hack Enough Registration',
    recipients: [{email: email}]
  });
  message.send();
}