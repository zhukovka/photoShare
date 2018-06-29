const {GraphQLServer} = require('graphql-yoga');
const {MongoClient} = require('mongodb')

const typeDefs = `
    type Query {
        gnar: String
    }
`;

const resolvers = {
    Query: {
        gnar: () => 'gnarly!!!'
    }
};

const port = 4000;

const options = {
    port,
    endpoint: '/graphql',
    playground: '/playground'
};

const ready = ({port}) => console.log(`graph service running - http://localhost:${port}`)

// 1. Create Asynchronous Function
async function start () {

    // 2. Connect to the database (asynchronous operation)
    const MONGO_DB = 'mongodb://localhost:27017/graphql-photos';
    const client = await MongoClient.connect(MONGO_DB);
    const db = client.db();

    // 3. Once connected, Add the database to context
    const context = {db};

    // 4. Start the server and send the context object
    const server = new GraphQLServer({typeDefs, resolvers, context});

    server.express.get('/', (req, res) => {
        res.end(`The PhotoShare Service - http://localhost:${port}/playground`)
    });

    server.start(options, ready);
}

// 5. Invoke start when ready to start
start();