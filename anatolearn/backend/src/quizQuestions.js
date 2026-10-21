const { validQuestion } = require('./questionBank');

async function withEditableQuiz(pool,quizId,operation) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const quiz=(await client.query('SELECT id FROM quizzes WHERE id=$1 FOR UPDATE',[quizId])).rows[0];
    if(!quiz)throw Object.assign(new Error('Quiz not found'),{status:404});
    const used=await client.query(`SELECT 1 FROM quiz_attempts WHERE quiz_id=$1 UNION ALL
      SELECT 1 FROM quiz_sessions WHERE quiz_id=$1 AND submitted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`,[quizId]);
    if(used.rows.length)throw Object.assign(new Error('This quiz has attempts or active sessions. Create a new quiz to change questions.'),{status:409});
    const result=await operation(client);
    await client.query(`UPDATE quizzes SET type=COALESCE((SELECT CASE WHEN COUNT(*)=0 THEN 'MCQ' WHEN bool_and(format='mcq') THEN 'MCQ' WHEN bool_and(format='open_ended') THEN 'Practical' ELSE 'Mixed' END::quiz_type FROM quiz_questions WHERE quiz_id=$1),'MCQ') WHERE id=$1`,[quizId]);
    await client.query('COMMIT');return result;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}

function values(q) {
  return [q.question.trim(),q.format,q.category||null,
    q.format==='mcq'?q.option_a:null,q.format==='mcq'?q.option_b:null,
    q.format==='mcq'?q.option_c:null,q.format==='mcq'?q.option_d:null,
    q.format==='mcq'?q.correct_option:null,q.format==='open_ended'?q.model_answer:null];
}

function registerQuizQuestions(app,pool,authenticate,requireTeacher) {
  app.post('/api/quizzes/:id/questions',authenticate,requireTeacher,async(req,res)=>{
    const q={...req.body,format:req.body.format||'mcq'};
    if(!validQuestion(q))return res.status(400).json({message:'Complete the question, its options and answer key'});
    const result=await withEditableQuiz(pool,req.params.id,async(client)=>(await client.query(`INSERT INTO quiz_questions(question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer,quiz_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[...values(q),req.params.id])).rows[0]);
    res.status(201).json(result);
  });
  app.put('/api/questions/:id',authenticate,requireTeacher,async(req,res)=>{
    const q={...req.body,format:req.body.format||'mcq'};
    if(!validQuestion(q))return res.status(400).json({message:'Complete the question, its options and answer key'});
    const quiz=(await pool.query('SELECT quiz_id FROM quiz_questions WHERE id=$1',[req.params.id])).rows[0];
    if(!quiz)return res.sendStatus(404);
    const result=await withEditableQuiz(pool,quiz.quiz_id,async(client)=>(await client.query(`UPDATE quiz_questions SET question=$1,format=$2,category=$3,option_a=$4,option_b=$5,option_c=$6,option_d=$7,correct_option=$8,model_answer=$9 WHERE id=$10 RETURNING *`,[...values(q),req.params.id])).rows[0]);
    if(!result)return res.sendStatus(404);res.json(result);
  });
  app.delete('/api/questions/:id',authenticate,requireTeacher,async(req,res)=>{
    const quiz=(await pool.query('SELECT quiz_id FROM quiz_questions WHERE id=$1',[req.params.id])).rows[0];
    if(!quiz)return res.sendStatus(404);
    await withEditableQuiz(pool,quiz.quiz_id,(client)=>client.query('DELETE FROM quiz_questions WHERE id=$1',[req.params.id]));
    res.json({message:'Question deleted'});
  });
}
module.exports={withEditableQuiz,registerQuizQuestions};
