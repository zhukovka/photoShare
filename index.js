const {GraphQLServer} = require('graphql-yoga');
const {MongoClient} = require('mongodb')
const fetch = require('node-fetch');
const fs = require('fs');

const typeDefs = fs.readFileSync(__dirname + '/schema.graphql', 'utf8');

const requestGithubToken = credentials =>
    fetch(
        'https://github.com/login/oauth/access_token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(credentials)
        }
    ).then(res => res.json())
        .catch(error => {
            throw new Error(JSON.stringify(error))
        })

const requestGithubUserAccount = token =>
    fetch(`https://api.github.com/user?access_token=${token}`)
        .then(res => res.json())
        .catch(error => {
            throw new Error(JSON.stringify(error))
        })

async function authorizeWithGithub (credentials) {
    const {access_token} = await requestGithubToken(credentials)
    const githubUser = await requestGithubUserAccount(access_token)
    return {...githubUser, access_token}
}

const GITHUB_CLIENT_ID = "ff1a4dfc74386675430f";
const GITHUB_CLIENT_SECRET = "911828123e87ea27115162758765b04599e95d47";
const resolvers = {
    Query: {

        totalPhotos: (parent, args, ctx) =>
            ctx.db.collection('photos').count(),

        allPhotos: (parent, args, ctx) =>
            ctx.db.collection('photos').find().toArray(),

        totalUsers: (parent, args, {db}) =>
            db.collection('users').count(),

        allUsers: (parent, args, {db}) =>
            db.collection('users').find().toArray(),
        me: (parent, args, ctx) => ctx.user

    },
    Mutation: {

        async githubAuth (root, {code}, {db}) {

            // 1. Obtain data from GitHub

            var {
                message,
                access_token,
                avatar_url,
                login,
                name
            } = await authorizeWithGithub({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code
            })

            // 2. If there is a message, something went wrong
            if (message) {
                throw new Error(message)
            }

            // 3. Package the results in a single object
            var user = {
                name,
                githubLogin: login,
                githubToken: access_token,
                avatar: avatar_url
            }

            // 4. See if the account exists
            var hasAccount = await db.collection('users').findOne({githubLogin: login})

            if (hasAccount) {

                // 5. If so, update the record with the latest info
                await db.collection('users')
                    .findOneAndUpdate({githubLogin: login}, user)

            } else {

                // 6. If not, add the user
                await db.collection('users').insert(user)

            }

            // 7. Return user data and their token
            return {user, token: access_token}

        },
        async postPhoto(root, args, ctx) {

            // 1. If there is not a user in context, throw an error
            if (!ctx.user) {
                throw new Error('only an authorized user can post a photo')
            }

            // 2. Save the current user's id with the photo
            const newPhoto = {
                ...args.input,
                userID: ctx.user.githubLogin,
                created: new Date()
            }

            // 3. Insert the new photo, capture the id that the database created
            const { insertedIds } = await ctx.db.collection('photos').insert(newPhoto);
            newPhoto.id = insertedIds[0];

            return newPhoto

        }
    },
    Photo: {
        id: parent => parent.id || parent._id,
        url: parent => `/img/photos/${parent._id}.jpg`,
        postedBy: (parent, args, { db }) =>
            db.collection('users').findOne({ githubLogin: parent.userID })
    }
};

const port = 4000;

const options = {
    port,
    endpoint: '/graphql',
    playground: '/playground'
};

const ready = ({port}) => console.log(`graph service running - http://localhost:${port}`);

// 1. Create Asynchronous Function
async function start () {

    // 2. Connect to the database (asynchronous operation)
    const MONGO_DB = 'mongodb://localhost:27017/graphql-photos';
    const client = await MongoClient.connect(MONGO_DB);
    const db = client.db();

    // 3. Once connected, Add the database to context
    const context = async ({ request }) => {

        var auth = request.headers.authorization
        var githubToken = auth && auth.replace('bearer ', '')
        var user = await db.collection('users').findOne({ githubToken })

        return {db, user}
    };

    // 4. Start the server and send the context object
    const server = new GraphQLServer({typeDefs, resolvers, context});

    server.express.get('/', (req, res) => {
        res.end(`The PhotoShare Service - http://localhost:${port}/playground`)
    });

    server.start(options, ready);
}

// 5. Invoke start when ready to start
start();



