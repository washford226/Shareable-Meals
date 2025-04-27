import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import mealRoutes from './routes/mealRoutes';

const app = express();
const PORT = 4000;

app.use(bodyParser.json()); //Parse incoming JSON data

app.use('/api', mealRoutes);

app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the Meal API');
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});